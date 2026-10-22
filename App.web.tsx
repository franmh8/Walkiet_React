import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import NativeApp from './src/native/NativeApp';

export default function App() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 600;

  if (isLargeScreen) {
    return (
      <View style={styles.webContainer}>
        <View style={styles.deviceFrame}>
          <NativeApp />
        </View>
      </View>
    );
  }

  return <NativeApp />;
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh' as any,
    width: '100vw' as any,
  },
  deviceFrame: {
    width: 440,
    height: '92vh' as any,
    maxHeight: 880,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#1e293b',
    backgroundColor: '#070b13',
  },
});
