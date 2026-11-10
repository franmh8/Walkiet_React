import app from './app.json';
// Solo estos valores públicos van a la app. Las claves LiveKit/APNs/FCM pertenecen al servidor/EAS.
export default {
  ...app.expo,
  plugins: [
    ['expo-image-picker', { photosPermission: 'Autoriza tus fotos para elegir una imagen de perfil.', cameraPermission: 'Autoriza la cámara para tomar tu foto de perfil.' }],
    ['@livekit/react-native-expo-plugin', { android: { audioType: 'communication' } }],
    ['@config-plugins/react-native-webrtc', { microphonePermission: 'Autoriza el micrófono para hablar por la radio del grupo.', cameraPermission: 'Autoriza la cámara para escanear códigos QR.' }],
    ['expo-notifications', { enableBackgroundRemoteNotifications: true }],
  ],
  ios: {
    ...app.expo.ios,
    infoPlist: { ...app.expo.ios.infoPlist, UIBackgroundModes: ['audio', 'remote-notification'] },
  },
  android: {
    ...app.expo.android,
    ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
    permissions: [...app.expo.android.permissions, 'android.permission.POST_NOTIFICATIONS', 'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.FOREGROUND_SERVICE', 'android.permission.FOREGROUND_SERVICE_MICROPHONE', 'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK'],
  },
  extra: { ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID ? { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } } : {}) },
};
