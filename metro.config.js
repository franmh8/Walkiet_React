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

// Asegurar que node_modules se resuelva de manera confiable
config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(__dirname, 'node_modules'),
  ],
};

module.exports = config;
