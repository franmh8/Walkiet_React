import React from 'react';
import { View, StyleSheet } from 'react-native';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/**
 * Minimalist outline User icon (matches Lucide User line aesthetic)
 */
export const UserIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#94a3b8',
  strokeWidth = 1.6,
}) => {
  const headSize = Math.round(size * 0.44);
  const bodyWidth = Math.round(size * 0.78);
  const bodyHeight = Math.round(size * 0.38);

  return (
    <View style={[styles.center, { width: size, height: size }]}>
      {/* Head */}
      <View
        style={{
          width: headSize,
          height: headSize,
          borderRadius: headSize / 2,
          borderWidth: strokeWidth,
          borderColor: color,
          marginBottom: 1,
        }}
      />
      {/* Shoulders outline arch */}
      <View
        style={{
          width: bodyWidth,
          height: bodyHeight,
          borderTopLeftRadius: bodyWidth / 2,
          borderTopRightRadius: bodyWidth / 2,
          borderWidth: strokeWidth,
          borderBottomWidth: 0,
          borderColor: color,
        }}
      />
    </View>
  );
};

/**
 * Minimalist outline Padlock icon (matches Lucide Lock line aesthetic)
 */
export const LockIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#94a3b8',
  strokeWidth = 1.6,
}) => {
  const shackleWidth = Math.round(size * 0.48);
  const shackleHeight = Math.round(size * 0.38);
  const bodyWidth = Math.round(size * 0.75);
  const bodyHeight = Math.round(size * 0.48);

  return (
    <View style={[styles.center, { width: size, height: size }]}>
      {/* Shackle */}
      <View
        style={{
          width: shackleWidth,
          height: shackleHeight,
          borderTopLeftRadius: shackleWidth / 2,
          borderTopRightRadius: shackleWidth / 2,
          borderWidth: strokeWidth,
          borderBottomWidth: 0,
          borderColor: color,
          marginBottom: -1,
        }}
      />
      {/* Body */}
      <View
        style={{
          width: bodyWidth,
          height: bodyHeight,
          borderRadius: 3.5,
          borderWidth: strokeWidth,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Keyhole dot */}
        <View
          style={{
            width: strokeWidth * 1.3,
            height: strokeWidth * 2,
            borderRadius: 1,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
};

/**
 * Minimalist outline Eye / EyeOff icon (matches Lucide Eye & EyeOff)
 */
export const EyeIcon: React.FC<IconProps & { off?: boolean }> = ({
  size = 18,
  color = '#94a3b8',
  strokeWidth = 1.6,
  off = false,
}) => {
  const eyeWidth = Math.round(size * 0.92);
  const eyeHeight = Math.round(size * 0.54);
  const pupilSize = Math.round(size * 0.26);

  return (
    <View style={[styles.center, { width: size, height: size }]}>
      {/* Almond eye contour */}
      <View
        style={{
          width: eyeWidth,
          height: eyeHeight,
          borderTopLeftRadius: eyeWidth * 0.5,
          borderTopRightRadius: eyeWidth * 0.5,
          borderBottomLeftRadius: eyeWidth * 0.5,
          borderBottomRightRadius: eyeWidth * 0.5,
          borderWidth: strokeWidth,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Pupil */}
        <View
          style={{
            width: pupilSize,
            height: pupilSize,
            borderRadius: pupilSize / 2,
            borderWidth: strokeWidth,
            borderColor: color,
          }}
        />
      </View>
      {/* Diagonal slash when off */}
      {off && (
        <View
          style={{
            position: 'absolute',
            width: strokeWidth,
            height: size * 0.95,
            backgroundColor: color,
            transform: [{ rotate: '45deg' }],
          }}
        />
      )}
    </View>
  );
};

/**
 * Minimalist outline Key icon (matches Lucide KeyRound line aesthetic)
 */
export const KeyIcon: React.FC<IconProps> = ({
  size = 16,
  color = '#64748b',
  strokeWidth = 1.6,
}) => {
  const bowSize = Math.round(size * 0.44);
  const shaftLength = Math.round(size * 0.42);

  return (
    <View
      style={[
        styles.center,
        {
          width: size,
          height: size,
          transform: [{ rotate: '-45deg' }],
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Bow (circular head) */}
        <View
          style={{
            width: bowSize,
            height: bowSize,
            borderRadius: bowSize / 2,
            borderWidth: strokeWidth,
            borderColor: color,
          }}
        />
        {/* Key shaft */}
        <View
          style={{
            width: shaftLength,
            height: strokeWidth,
            backgroundColor: color,
            marginLeft: -1,
          }}
        />
        {/* Teeth */}
        <View
          style={{
            position: 'absolute',
            right: 2,
            top: bowSize / 2,
            width: strokeWidth,
            height: 3,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
};

/**
 * Minimalist outline UserPlus icon (matches Lucide UserPlus line aesthetic)
 */
export const UserPlusIcon: React.FC<IconProps> = ({
  size = 16,
  color = '#691c32',
  strokeWidth = 1.5,
}) => {
  const headSize = Math.round(size * 0.34);
  const bodyWidth = Math.round(size * 0.58);
  const bodyHeight = Math.round(size * 0.28);
  const plusSize = Math.round(size * 0.32);

  return (
    <View style={{ width: size, height: size, justifyContent: 'center' }}>
      {/* Mini user bust outline */}
      <View style={{ position: 'absolute', left: 0, top: 1, alignItems: 'center' }}>
        <View
          style={{
            width: headSize,
            height: headSize,
            borderRadius: headSize / 2,
            borderWidth: strokeWidth,
            borderColor: color,
            marginBottom: 1,
          }}
        />
        <View
          style={{
            width: bodyWidth,
            height: bodyHeight,
            borderTopLeftRadius: bodyWidth / 2,
            borderTopRightRadius: bodyWidth / 2,
            borderWidth: strokeWidth,
            borderBottomWidth: 0,
            borderColor: color,
          }}
        />
      </View>
      {/* Plus symbol */}
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: Math.round(size * 0.22),
          width: plusSize,
          height: plusSize,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            position: 'absolute',
            width: plusSize,
            height: strokeWidth,
            backgroundColor: color,
            borderRadius: 1,
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: strokeWidth,
            height: plusSize,
            backgroundColor: color,
            borderRadius: 1,
          }}
        />
      </View>
    </View>
  );
};

/**
 * Minimalist outline Alert Triangle icon (matches Lucide AlertTriangle)
 */
export const AlertTriangleIcon: React.FC<IconProps> = ({
  size = 16,
  color = '#be123c',
  strokeWidth = 1.5,
}) => {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      {/* Triangle outer */}
      <View
        style={{
          width: 0,
          height: 0,
          backgroundColor: 'transparent',
          borderStyle: 'solid',
          borderLeftWidth: Math.round(size * 0.46),
          borderRightWidth: Math.round(size * 0.46),
          borderBottomWidth: Math.round(size * 0.8),
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
        }}
      />
      {/* Triangle inner cutout */}
      <View
        style={{
          position: 'absolute',
          top: Math.round(size * 0.22),
          width: 0,
          height: 0,
          backgroundColor: 'transparent',
          borderStyle: 'solid',
          borderLeftWidth: Math.round(size * 0.3),
          borderRightWidth: Math.round(size * 0.3),
          borderBottomWidth: Math.round(size * 0.52),
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: '#fff1f2',
        }}
      />
      {/* Exclamation mark */}
      <View style={{ position: 'absolute', top: Math.round(size * 0.36), alignItems: 'center' }}>
        <View style={{ width: strokeWidth, height: Math.round(size * 0.22), backgroundColor: color, borderRadius: 1 }} />
        <View style={{ width: strokeWidth, height: strokeWidth, backgroundColor: color, borderRadius: strokeWidth / 2, marginTop: 1.5 }} />
      </View>
    </View>
  );
};

/**
 * Minimalist outline Check Circle icon (matches Lucide CheckCircle2)
 */
export const CheckCircleIcon: React.FC<IconProps> = ({
  size = 16,
  color = '#059669',
  strokeWidth = 1.6,
}) => {
  return (
    <View
      style={[
        styles.center,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: color,
        },
      ]}
    >
      <View
        style={{
          width: Math.round(size * 0.44),
          height: Math.round(size * 0.24),
          borderBottomWidth: strokeWidth,
          borderLeftWidth: strokeWidth,
          borderColor: color,
          transform: [{ rotate: '-45deg' }, { translateY: -1 }],
        }}
      />
    </View>
  );
};

/**
 * Minimalist outline Phone icon (matches Lucide Phone)
 */
export const PhoneIcon: React.FC<IconProps> = ({
  size = 16,
  color = '#94a3b8',
  strokeWidth = 1.5,
}) => {
  return (
    <View
      style={[
        styles.center,
        {
          width: size,
          height: size,
          transform: [{ rotate: '-25deg' }],
        },
      ]}
    >
      <View
        style={{
          width: Math.round(size * 0.72),
          height: Math.round(size * 0.72),
          borderLeftWidth: strokeWidth * 1.5,
          borderBottomWidth: strokeWidth * 1.5,
          borderTopWidth: strokeWidth,
          borderRightWidth: strokeWidth,
          borderColor: color,
          borderTopLeftRadius: Math.round(size * 0.35),
          borderBottomLeftRadius: 4,
          borderBottomRightRadius: 4,
          borderTopRightRadius: 2,
        }}
      />
    </View>
  );
};

/**
 * Minimalist outline Mail icon (matches Lucide Mail)
 */
export const MailIcon: React.FC<IconProps> = ({
  size = 16,
  color = '#94a3b8',
  strokeWidth = 1.5,
}) => {
  const w = Math.round(size * 0.88);
  const h = Math.round(size * 0.62);
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View
        style={{
          width: w,
          height: h,
          borderRadius: 3,
          borderWidth: strokeWidth,
          borderColor: color,
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: Math.round(w * 0.7),
            height: Math.round(w * 0.7),
            borderBottomWidth: strokeWidth,
            borderRightWidth: strokeWidth,
            borderColor: color,
            transform: [{ rotate: '45deg' }, { translateY: -Math.round(w * 0.35) }],
          }}
        />
      </View>
    </View>
  );
};

/**
 * Minimalist outline ArrowLeft icon
 */
export const ArrowLeftIcon: React.FC<IconProps> = ({
  size = 14,
  color = '#64748b',
  strokeWidth = 1.6,
}) => {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View style={{ width: Math.round(size * 0.7), height: strokeWidth, backgroundColor: color }} />
      <View
        style={{
          position: 'absolute',
          left: 1,
          width: Math.round(size * 0.35),
          height: Math.round(size * 0.35),
          borderLeftWidth: strokeWidth,
          borderBottomWidth: strokeWidth,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
};

/**
 * Minimalist outline RotateCw icon
 */
export const RotateCwIcon: React.FC<IconProps> = ({
  size = 14,
  color = '#64748b',
  strokeWidth = 1.5,
}) => {
  return (
    <View
      style={[
        styles.center,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderTopColor: 'transparent',
          borderRightColor: color,
          borderBottomColor: color,
          borderLeftColor: color,
        },
      ]}
    >
      <View
        style={{
          position: 'absolute',
          top: -1,
          right: -1,
          width: 0,
          height: 0,
          borderLeftWidth: 3,
          borderRightWidth: 3,
          borderBottomWidth: 4,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
