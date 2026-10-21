// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure compatibility with React Native 0.76+ polyfill changes
config.serializer = {
  ...config.serializer,
  getPolyfills: () => [],
};

// Ensure node_modules is resolvable by Metro
config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(__dirname, 'node_modules'),
  ],
};

module.exports = config;
