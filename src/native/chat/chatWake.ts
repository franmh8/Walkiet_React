import {AppState, Platform} from 'react-native';
export function watchChatWake(wake: () => void) {
  const sub = AppState.addEventListener('change', wake);
  if (Platform.OS === 'web') {window.addEventListener('online', wake); document.addEventListener('visibilitychange', wake);}
  return () => {
    sub.remove();
    if (Platform.OS === 'web') {window.removeEventListener('online', wake); document.removeEventListener('visibilitychange', wake);}
  };
}
