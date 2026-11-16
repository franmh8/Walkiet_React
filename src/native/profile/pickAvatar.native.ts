export async function pickAvatar(source: 'camera' | 'library'): Promise<string | null> {
  try {
    const picker = require('expo-image-picker') as typeof import('expo-image-picker');
    const permission = source === 'camera' ? await picker.requestCameraPermissionsAsync() : await picker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error('Autoriza el acceso a la cámara o a tus fotos para cambiar la imagen.');
    const options = { mediaTypes: ['images'] as ('images')[], allowsEditing: true, aspect: [1,1] as [number,number], quality: 0.8 };
    const result = source === 'camera' ? await picker.launchCameraAsync(options) : await picker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.[0]) return null;
    const image = result.assets[0]; const side = Math.min(image.width, image.height);
    const manipulator = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
    const output = await manipulator.manipulateAsync(image.uri, [{ crop: { originX: (image.width-side)/2, originY: (image.height-side)/2, width: side, height: side } }, { resize: { width: 320, height: 320 } }], { format: manipulator.SaveFormat.JPEG, compress: 0.72, base64: true });
    if (!output.base64 || output.base64.length > 175000) throw new Error('La foto es demasiado grande. Selecciona otra imagen.');
    return 'data:image/jpeg;base64,' + output.base64;
  } catch (cause) {
    if (cause instanceof Error && /native module|Cannot find/i.test(cause.message)) throw new Error('Instala la compilación actualizada de la app para elegir fotos.');
    throw cause;
  }
}
