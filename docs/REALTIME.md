# QTalK gerçek zamanlı iletişim

QTalK API Worker, her kanal için bir Cloudflare Durable Object odası açar:

```text
wss://qtalk-api.1onplayer.workers.dev/ws/<channelId>?userId=<id>&name=<display-name>
```

Canlı health kontrolü: <https://qtalk-api.1onplayer.workers.dev/health>

## Sinyal mesajları

İstemci şu mesaj türlerini gönderebilir: `join`, `offer`, `answer`, `ice`, `talk-start`, `talk-stop`, `leave`.

Örnek:

```js
socket.send(JSON.stringify({
  type: 'offer',
  to: 'peer-user-id',
  data: { sdp: '...' }
}));
```

Sunucu, kanal odasındaki diğer bağlantılara `from`, `to`, `data` ve `at` alanlarıyla iletir. `to` gönderilirse yalnızca hedef kullanıcıya gönderilir. Oda, WebSocket hibernation API kullandığı için boşta kalan bağlantıları açık tutarken Worker belleğini gereksiz yere meşgul etmez.

## Deploy

```bash
npx wrangler login
npx wrangler deploy
```

İlk deploy, `wrangler.toml` içindeki `QTALK_ROOMS` Durable Object binding’i ve `v1` migration’ı oluşturur. API URL’ini mobil uygulama için `QTALK_API_URL` veya `EXPO_PUBLIC_QTALK_API_URL` olarak ayarlayın.

Bu katman sinyalizasyon içindir. Gerçek ses taşımak için WebRTC medya akışı veya Cloudflare Realtime SFU eklenmelidir; ses byte’larını WebSocket üzerinden taşımak önerilmez.
