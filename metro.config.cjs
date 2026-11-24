// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Utilizar los polyfills canónicos de React Native (@react-native/js-polyfills)
config.serializer = {
  ...config.serializer,
  getPolyfills: () => {
    try {
      return require('@react-native/js-polyfills')();
    } catch {
      return [
        require.resolve('@react-native/js-polyfills/console.js'),
        require.resolve('@react-native/js-polyfills/error-guard.js'),
      ];
    }
  },
};

const defaultResolveRequest = config.resolver.resolveRequest;

// Asegurar que node_modules se resuelva de manera confiable y silenciar version mismatch en Expo Go
config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(__dirname, 'node_modules'),
  ],
  resolveRequest: (context, moduleName, platform) => {
    if (
      moduleName === './ReactNativeVersionCheck' ||
      moduleName === 'react-native/Libraries/Core/ReactNativeVersionCheck' ||
      moduleName.endsWith('/ReactNativeVersionCheck') ||
      moduleName.endsWith('/ReactNativeVersionCheck.js')
    ) {
      return {
        filePath: path.resolve(__dirname, 'src/polyfills/ReactNativeVersionCheck.js'),
        type: 'sourceFile',
      };
    }
    if (defaultResolveRequest) {
      return defaultResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
