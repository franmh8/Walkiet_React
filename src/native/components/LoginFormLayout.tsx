import React, {useEffect, useState, type ReactNode} from 'react';
import {Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type StyleProp, type ViewStyle} from 'react-native';

export function LoginFormLayout({children, contentContainerStyle}: {
  children: ReactNode; contentContainerStyle: StyleProp<ViewStyle>;
}) {
  const mobile = Platform.OS === 'ios' || Platform.OS === 'android';
  const [keyboardVisible, setKeyboardVisible] = useState(() => mobile && Keyboard.isVisible());

  useEffect(() => {
    if (!mobile) return;
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, [mobile]);

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.wrapper}>
    <ScrollView
      testID="login-scroll"
      contentContainerStyle={[contentContainerStyle, mobile && (keyboardVisible ? styles.raised : styles.centered)]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={mobile ? 'on-drag' : 'none'}
      showsVerticalScrollIndicator={false}
    >{children}</ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  wrapper: {flex: 1},
  centered: {justifyContent: 'center'},
  raised: {justifyContent: 'flex-start'},
});
