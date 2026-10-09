import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import QRCode from 'qrcode';

interface QrCodeViewProps {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
}

export const QrCodeView: React.FC<QrCodeViewProps> = ({
  value,
  size = 200,
  color = '#000000',
  backgroundColor = '#ffffff',
}) => {
  // Genera matriz estándar internacional QR (ISO/IEC 18004) con nivel de corrección Medio (15%)
  const matrix = useMemo(() => {
    try {
      const cleanValue = (value && value.trim()) || 'c5i://canal/general';
      const qr = QRCode.create(cleanValue, {
        errorCorrectionLevel: 'M',
      });
      const moduleCount = qr.modules.size;
      const result: boolean[][] = [];

      for (let r = 0; r < moduleCount; r++) {
        const row: boolean[] = [];
        for (let c = 0; c < moduleCount; c++) {
          row.push(Boolean(qr.modules.get(r, c)));
        }
        result.push(row);
      }
      return result;
    } catch (e) {
      console.warn('Error generando QR estándar con qrcode:', e);
      return [];
    }
  }, [value]);

  if (!matrix || matrix.length === 0) {
    return null;
  }

  // Margen estándar "quiet zone" de 3 módulos para garantizar detección instantánea por cámaras móviles
  const margin = 3;
  const N = matrix.length + margin * 2;
  const cellSize = size / N;

  return (
    <View style={[styles.container, { width: size, height: size, backgroundColor }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Rect width={size} height={size} fill={backgroundColor} rx={12} />
        {matrix.map((row, r) =>
          row.map((active, c) => {
            if (!active) return null;
            return (
              <Rect
                key={`qr-${r}-${c}`}
                x={(c + margin) * cellSize}
                y={(r + margin) * cellSize}
                width={cellSize + 0.05}
                height={cellSize + 0.05}
                fill={color}
              />
            );
          })
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
});
