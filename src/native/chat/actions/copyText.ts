export async function copyMessageText(text: string) {
  try {const clipboard = await import('expo-clipboard'); await clipboard.setStringAsync(text);}
  catch {throw new Error('No se pudo copiar. Actualiza la aplicación e inténtalo de nuevo.');}
}
