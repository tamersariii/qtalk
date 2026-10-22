export function createQTalkSocket({ apiUrl, channelId, userId, name, onSignal, onStatus = () => {} }) {
  const base = apiUrl.replace(/^http/, 'ws').replace(/\/$/, '');
  const url = `${base}/ws/${encodeURIComponent(channelId)}?userId=${encodeURIComponent(userId)}&name=${encodeURIComponent(name)}`;
  const socket = new WebSocket(url);

  socket.onopen = () => onStatus('connected');
  socket.onclose = () => onStatus('closed');
  socket.onerror = () => onStatus('error');
  socket.onmessage = (event) => {
    try { onSignal(JSON.parse(event.data)); } catch { onStatus('invalid-message'); }
  };

  return {
    socket,
    send(type, data = null, to = null) {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type, data, to }));
    },
    close() { socket.close(1000, 'QTalK channel closed'); }
  };
}
