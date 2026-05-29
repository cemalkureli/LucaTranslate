import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'LucaTranslate',
  slug: 'luca-translate',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#000000'
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.lingua.translator',
    infoPlist: {
      NSMicrophoneUsageDescription: 'Used for voice translation'
    }
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#000000'
    },
    package: 'com.lingua.translator',
    permissions: ['RECORD_AUDIO', 'INTERNET', 'ACCESS_NETWORK_STATE', 'CAMERA']
  },
  plugins: [
    'expo-router',
    [
      'expo-av',
      { microphonePermission: 'Allow LucaTranslate to access your microphone for voice translation.' }
    ],
    [
      'expo-camera',
      { cameraPermission: 'Allow LucaTranslate to access your camera for text recognition.' }
    ],
    [
      'expo-image-picker',
      {
        cameraPermission: 'Allow LucaTranslate to access your camera.',
        photosPermission: 'Allow LucaTranslate to access your photos.'
      }
    ],
    [
      'react-native-vision-camera',
      {
        cameraPermissionText: 'LucaTranslate kamera erişimi istiyor.',
        enableFrameProcessors: false
      }
    ]
  ],
  scheme: 'lingua',
  extra: {
    eas: { projectId: 'badabeb4-5d26-499b-bf8f-dc11e28bfc02' },
    LIBRETRANSLATE_URL: process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com',
    LIBRETRANSLATE_API_KEY: process.env.LIBRETRANSLATE_API_KEY || ''
  }
});