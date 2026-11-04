import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      '@expo/vector-icons': path.resolve(__dirname, 'src/polyfills/vector-icons.tsx'),
      'expo-camera': path.resolve(__dirname, 'src/polyfills/expo-camera.tsx'),
      'expo-modules-core': path.resolve(__dirname, 'src/polyfills/expo-modules-core.tsx'),
    },
    extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js'],
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
});
