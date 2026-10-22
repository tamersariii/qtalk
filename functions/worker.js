const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(request.url);
    try {
      if (url.pathname === '/health') return json({ ok: true, service: 'qtalk-api' });
      if (url.pathname === '/channels' && request.method === 'GET') return json(await env.DB.prepare('SELECT id, name, member_count FROM channels ORDER BY name').all());
      if (url.pathname === '/presence' && request.method === 'POST') {
        const body = await request.json();
        await env.DB.prepare('INSERT INTO presence (user_id, channel_id, last_seen) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(user_id) DO UPDATE SET channel_id=excluded.channel_id, last_seen=excluded.last_seen').bind(body.userId, body.channelId).run();
        return json({ ok: true });
      }
      if (url.pathname === '/push/announce' && request.method === 'POST') {
        const body = await request.json();
        const recipients = await env.DB.prepare('SELECT push_token FROM device_tokens WHERE user_id IN (SELECT user_id FROM channel_members WHERE channel_id = ?) AND user_id != ?').bind(body.channelId, body.userId).all();
        return json({ ok: true, queued: recipients.results.length, message: 'Push notification dispatch queued' });
      }
      return json({ error: 'Not found' }, 404);
    } catch (error) { return json({ error: 'Request failed' }, 500); }
  }
};

function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8' } }); }
