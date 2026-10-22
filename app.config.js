module.exports = {
  expo: {
    name: 'QTalK',
    slug: 'qtalk',
    version: '0.1.2',
    orientation: 'portrait',
    scheme: 'qtalk',
    userInterfaceStyle: 'dark',
    icon: './assets/qtalk-icon.png',
    splash: {
      image: './assets/qtalk-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#07111F'
    },
    android: {
      package: 'com.tamersariii.qtalk',
      adaptiveIcon: {
        foregroundImage: './assets/qtalk-icon.png',
        backgroundColor: '#07111F'
      },
      permissions: [
        'RECORD_AUDIO',
        'BLUETOOTH',
        'BLUETOOTH_ADMIN',
        'BLUETOOTH_SCAN',
        'BLUETOOTH_CONNECT',
        'ACCESS_FINE_LOCATION',
        'READ_CONTACTS',
        'POST_NOTIFICATIONS',
        'REQUEST_INSTALL_PACKAGES'
      ]
    },
    plugins: [
      'expo-notifications',
      'expo-contacts',
      'expo-av',
      '@config-plugins/react-native-webrtc'
    ],
    extra: {
      apiUrl: process.env.QTALK_API_URL || 'https://qtalk-api.1onplayer.workers.dev'
    }
  }
};
