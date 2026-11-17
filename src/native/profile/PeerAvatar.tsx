import React, { useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export function PeerAvatar({ uri, name, style, children }: {
  uri?: string | null; name: string; style?: StyleProp<ViewStyle>; children: React.ReactNode;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return <View style={[style, { overflow: 'hidden' }]}>
    {uri && failed !== uri
      ? <Image key={uri} source={{ uri }} resizeMode="cover" accessibilityLabel={`Foto de ${name}`}
          style={StyleSheet.absoluteFill} onError={() => setFailed(uri)} />
      : children}
  </View>;
}
