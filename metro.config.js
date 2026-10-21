// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Inyectar únicamente el polyfill puro de ErrorUtils (sin require() de CommonJS)
config.serializer = {
  ...config.serializer,
  getPolyfills: () => [
    path.resolve(__dirname, 'src/polyfills/error-guard.js'),
  ],
};

// Asegurar que node_modules se resuelva de manera confiable
config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(__dirname, 'node_modules'),
  ],
};

module.exports = config;
