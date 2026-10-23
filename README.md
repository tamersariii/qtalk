# QTalK

Şık ve sade React Native/Expo bas-konuş uygulaması. İnternet üzerinden WebRTC, Bluetooth yakın alan keşfi, kişi listesi, ses kayıtları, profil ve tema seçenekleri içerir.

## Durum

QTalK Android ve iOS için aynı React Native kod tabanını kullanır. Android APK CI üzerinden üretilir; iOS için native bundle kimliği ve Google Sign-In config’i hazırdır. Cloudflare Worker + D1 backend kaynakları `functions/` ve `cloudflare/` altındadır.

Gerçek zamanlı kanal sinyalizasyonu için Cloudflare Durable Objects tabanlı WebSocket katmanı `/ws/:channelId` uç noktasına eklendi. Ayrıntılar: [Gerçek zamanlı iletişim](docs/REALTIME.md).

## Android APK indir

Doğrudan indirme: [QTalK v0.2.0 WebRTC APK](https://github.com/tamersariii/qtalk/releases/download/v0.2.0/qtalk-webrtc.apk)

Telefon kamerasıyla taramak için:

![QTalK APK indirme QR kodu](assets/qtalk-apk-qr.png)

Alternatif olarak [GitHub Release sayfasını](https://github.com/tamersariii/qtalk/releases/tag/v0.2.0) açabilirsiniz.

## QTalK sitesi

GitHub Pages sitesi: [QTalK uygulama sitesi](https://tamersariii.github.io/qtalk/)

## Kurulum

```bash
npm install
npx expo start
```

Bluetooth ve native Google hesap seçici için Expo Go yerine native development build gerekir. `@react-native-google-signin/google-signin` Android’de cihaz hesap seçicisini, iOS’ta native Google account flow’u kullanır; tarayıcı OAuth fallback’i kullanılmaz.

Google’ın üretim için istemci kimlikleri ve Android SHA-1/iOS URL scheme ayarları ayrıca tanımlanmalıdır. Bu değerler olmadan uygulama, kullanıcıya yapılandırma uyarısı gösterir.

## Cloudflare

1. `cloudflare/migrations/0001_initial.sql` ve `0002_auth_profiles.sql` ile D1 şemasını uygulayın.
2. `wrangler.toml` içindeki `database_id` değerini gerçek D1 ID ile değiştirin.
3. `npx wrangler deploy` çalıştırın.
4. Mobil uygulamada `QTALK_API_URL` değişkenini Worker URL’i ile ayarlayın.

## Android paketleme

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

## iOS paketleme

Apple Developer hesabı ve macOS/Xcode veya EAS hesabı gerekir:

```bash
npx expo prebuild --platform ios
npx expo run:ios
```

TestFlight/App Store yayını için Apple imzalama bilgileri gereklidir. GitHub Pages sitesi iOS TestFlight bağlantısını, bağlantı oluşturulduğunda aktif hale getirecek şekilde hazırlanmıştır.

## Gizlilik ve lisans

- [Gizlilik Politikası](docs/PRIVACY.md)
- [MIT Lisansı](LICENSE)
