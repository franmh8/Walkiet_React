import React from 'react';
import { Platform } from 'react-native';
import WebApp from './src/App';
import NativeApp from './src/native/NativeApp';

export default function App() {
  if (Platform.OS === 'web') {
    return <WebApp />;
  }
  return <NativeApp />;
}
