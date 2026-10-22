# QTalK

Şık ve sade Android bas-konuş uygulaması. İnternet kanalları, Bluetooth yakın alan keşfi, kişi listesi ve bildirim altyapısı içerir.

## Durum

Bu repo, QTalK’ın ilk çalışan yerel prototipidir. Arayüz ve Android izin akışları hazırdır. Cloudflare Worker + D1 backend kaynakları `functions/` ve `cloudflare/` altındadır.

Gerçek zamanlı kanal sinyalizasyonu için Cloudflare Durable Objects tabanlı hibernation WebSocket katmanı `/ws/:channelId` uç noktasına eklendi. Ayrıntılar: [Gerçek zamanlı iletişim](docs/REALTIME.md).

## Android APK indir

Doğrudan indirme: [QTalK v0.1.1 WebRTC APK](https://github.com/tamersariii/qtalk/releases/download/v0.1.1/qtalk-webrtc.apk)

Telefon kamerasıyla taramak için:

![QTalK APK indirme QR kodu](assets/qtalk-apk-qr.png)

Alternatif olarak [GitHub Release sayfasını](https://github.com/tamersariii/qtalk/releases/tag/v0.1.1) açabilirsiniz.

## Kurulum

```bash
npm install
npx expo start
```

Bluetooth için Expo Go yerine native development build gerekir; `react-native-ble-plx` native modül kullanır.

## Cloudflare

1. `cloudflare/migrations/0001_initial.sql` ile D1 şemasını uygulayın.
2. `wrangler.toml` içindeki `database_id` değerini gerçek D1 ID ile değiştirin.
3. `npx wrangler deploy` çalıştırın.
4. Mobil uygulamada `QTALK_API_URL` değişkenini Worker URL’i ile ayarlayın.

## Android paketleme

Sandbox içinde Android SDK/Gradle bulunmadığı için burada doğrudan signed APK üretilmesi garanti değildir. Android SDK ve keystore bulunan CI veya geliştirici makinesinde:

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

## Gizlilik ve lisans

- [Gizlilik Politikası](docs/PRIVACY.md)
- [MIT Lisansı](LICENSE)
