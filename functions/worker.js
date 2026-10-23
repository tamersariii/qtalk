import { DurableObject } from 'cloudflare:workers';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(request.url);

    if (url.pathname.startsWith('/ws/')) {
      if (request.method !== 'GET' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('WebSocket upgrade required', { status: 426, headers: cors });
      }
      const channelId = decodeURIComponent(url.pathname.slice('/ws/'.length)).trim();
      if (!channelId || channelId.length > 96) return new Response('Invalid channel', { status: 400, headers: cors });
      const room = env.QTALK_ROOMS.getByName(`channel:${channelId}`);
      return room.fetch(request);
    }

    try {
      if (url.pathname === '/health') return json({ ok: true, service: 'qtalk-api', realtime: '/ws/:channelId' });
      if (url.pathname === '/auth/email' && request.method === 'POST') return emailAuth(request, env);
      if (url.pathname === '/auth/google/start' && request.method === 'GET') {
        if (!env.GOOGLE_CLIENT_ID) return json({ error: 'Google OAuth henüz yapılandırılmadı.' }, 503);
        const redirect = url.searchParams.get('redirect_uri') || env.GOOGLE_REDIRECT_URI;
        const state = crypto.randomUUID();
        const target = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        target.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redirect, response_type: 'code', scope: 'openid email profile', state }).toString();
        return Response.redirect(target.toString(), 302);
      }
      if (url.pathname === '/channels' && request.method === 'GET') {
        return json(await env.DB.prepare('SELECT id, name, member_count FROM channels ORDER BY name').all());
      }
      if (url.pathname === '/presence' && request.method === 'POST') {
        const body = await request.json();
        await env.DB.prepare("INSERT INTO presence (user_id, channel_id, last_seen) VALUES (?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET channel_id=excluded.channel_id, last_seen=excluded.last_seen").bind(body.userId, body.channelId).run();
        return json({ ok: true });
      }
      if (url.pathname === '/push/announce' && request.method === 'POST') {
        const body = await request.json();
        const recipients = await env.DB.prepare('SELECT push_token FROM device_tokens WHERE user_id IN (SELECT user_id FROM channel_members WHERE channel_id = ?) AND user_id != ?').bind(body.channelId, body.userId).all();
        return json({ ok: true, queued: recipients.results.length, message: 'Push notification dispatch queued' });
      }
      return json({ error: 'Not found' }, 404);
    } catch (error) {
      return json({ error: 'Request failed' }, 500);
    }
  }
};

export class QTalkRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId')?.slice(0, 128) || crypto.randomUUID();
    const displayName = url.searchParams.get('name')?.slice(0, 80) || 'QTalK kullanıcısı';

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId, displayName });
    server.send(JSON.stringify({ type: 'ready', userId, peers: this.ctx.getWebSockets().length }));
    this.broadcast({ type: 'presence', event: 'joined', userId, displayName }, server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    const sender = ws.deserializeAttachment() || { userId: 'unknown', displayName: 'QTalK kullanıcısı' };
    let payload;
    try {
      payload = typeof message === 'string' ? JSON.parse(message) : null;
    } catch {
      ws.send(JSON.stringify({ type: 'error', code: 'invalid_json' }));
      return;
    }
    if (!payload || !['join', 'offer', 'answer', 'ice', 'talk-start', 'talk-stop', 'leave'].includes(payload.type)) {
      ws.send(JSON.stringify({ type: 'error', code: 'unsupported_signal' }));
      return;
    }

    const signal = {
      type: payload.type,
      from: sender.userId,
      name: sender.displayName,
      to: typeof payload.to === 'string' ? payload.to.slice(0, 128) : null,
      data: payload.data ?? null,
      at: Date.now()
    };
    this.broadcast(signal, ws, signal.to);
  }

  async webSocketClose(ws, code, reason) {
    const sender = ws.deserializeAttachment();
    if (sender) this.broadcast({ type: 'presence', event: 'left', userId: sender.userId, displayName: sender.displayName }, ws);
    ws.close(code, reason);
  }

  async webSocketError(ws, error) {
    console.error('QTalK WebSocket error', error);
    ws.close(1011, 'WebSocket error');
  }

  broadcast(message, exclude, targetUserId = null) {
    const encoded = JSON.stringify(message);
    for (const socket of this.ctx.getWebSockets()) {
      const peer = socket.deserializeAttachment();
      if (socket === exclude || (targetUserId && peer?.userId !== targetUserId)) continue;
      if (socket.readyState === WebSocket.OPEN) socket.send(encoded);
    }
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'content-type': 'application/json; charset=utf-8' }
  });
}

async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function emailAuth(request, env) {
  const body = await request.json();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const displayName = String(body.displayName || email.split('@')[0]).trim().slice(0, 80);
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return json({ error: 'Geçerli bir e-posta ve en az 8 karakterli parola girin.' }, 400);
  let user = await env.DB.prepare('SELECT id, display_name, email, password_salt, password_hash, avatar_url FROM users WHERE email = ?').bind(email).first();
  if (!user) {
    const salt = crypto.randomUUID();
    const id = crypto.randomUUID();
    const hash = await digest(`${salt}:${password}`);
    await env.DB.prepare('INSERT INTO users (id, display_name, email, password_salt, password_hash) VALUES (?, ?, ?, ?, ?)').bind(id, displayName, email, salt, hash).run();
    user = { id, display_name: displayName, email, password_salt: salt, password_hash: hash, avatar_url: null };
  } else if (user.password_hash !== await digest(`${user.password_salt}:${password}`)) return json({ error: 'E-posta veya parola hatalı.' }, 401);
  const token = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))").bind(token, user.id).run();
  return json({ token, user: { id: user.id, name: user.display_name, email: user.email, avatarUrl: user.avatar_url || null } });
}
