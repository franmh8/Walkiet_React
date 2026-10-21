// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure essential runtime polyfills (like ErrorUtils) are injected before InitializeCore
config.serializer = {
  ...config.serializer,
  getPolyfills: () => [
    path.resolve(__dirname, 'src/polyfills/error-guard.js'),
    path.resolve(__dirname, 'node_modules/react-native/Libraries/Core/polyfillPromise.js'),
  ],
};

// Ensure node_modules is resolvable by Metro
config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(__dirname, 'node_modules'),
  ],
};

module.exports = config;
