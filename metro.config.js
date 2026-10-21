// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure compatibility with React Native 0.76+ polyfill changes
config.serializer = {
  ...config.serializer,
  getPolyfills: () => [],
};

module.exports = config;
