
import app from './app.base.json';

declare const process: {
  env: {
    GOOGLE_SERVICES_JSON?: string;
  };
};

// Solo estos valores públicos van a la app.
export default {
  ...app.expo,

  runtimeVersion: {
    policy: 'appVersion',
  },

  updates: {
    url: 'https://u.expo.dev/ff72cbc8-da97-417e-8c25-054a81a0f9ee',
  },

  plugins: [
    ...app.expo.plugins.filter(
      (plugin) =>
        (Array.isArray(plugin) ? plugin[0] : plugin) !==
        'expo-image-picker'
    ),

    [
      'expo-image-picker',
      {
        photosPermission:
          'Autoriza tus fotos para elegir tu imagen de perfil y compartir fotos en el chat.',
        cameraPermission:
          'Autoriza la cámara para tomar tu foto de perfil y compartir fotos en el chat.',
      },
    ],

    [
      '@livekit/react-native-expo-plugin',
      {
        android: {
          audioType: 'communication',
        },
      },
    ],

    [
      '@config-plugins/react-native-webrtc',
      {
        microphonePermission:
          'Autoriza el micrófono para hablar por la radio del grupo.',
        cameraPermission:
          'Autoriza la cámara para escanear códigos QR.',
      },
    ],

    [
      'expo-notifications',
      {
        enableBackgroundRemoteNotifications: true,
      },
    ],

    [
      'expo-build-properties',
      {
        android: {
          enableMinifyInReleaseBuilds: false,
        },
      },
    ],

    'expo-status-bar',
  ],

  ios: {
    ...app.expo.ios,
    infoPlist: {
      ...app.expo.ios.infoPlist,
      UIBackgroundModes: ['audio', 'remote-notification'],
    },
  },


android: {
  ...app.expo.android,
  softwareKeyboardLayoutMode: 'resize',
  ...(process.env.GOOGLE_SERVICES_JSON
    ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
    : {}),
  permissions: [
    ...app.expo.android.permissions,
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.MODIFY_AUDIO_SETTINGS',
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_MICROPHONE',
    'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  ],
},


  extra: {
    eas: {
      projectId: 'ff72cbc8-da97-417e-8c25-054a81a0f9ee',
    },
  },
};
