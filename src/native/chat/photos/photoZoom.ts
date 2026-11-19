export interface PhotoTransform {scale: number; x: number; y: number;}
export const fitPhoto = (imageWidth: number, imageHeight: number, width: number, height: number) => {
  const ratio = Math.min(width / Math.max(1, imageWidth), height / Math.max(1, imageHeight));
  return {width: imageWidth * ratio, height: imageHeight * ratio};
};
export function boundPhoto(value: PhotoTransform, image: {width: number; height: number}, viewport: {width: number; height: number}): PhotoTransform {
  const scale = Math.max(1, Math.min(5, value.scale));
  const maxX = Math.max(0, (image.width * scale - viewport.width) / 2), maxY = Math.max(0, (image.height * scale - viewport.height) / 2);
  return {scale, x: Math.max(-maxX, Math.min(maxX, value.x)), y: Math.max(-maxY, Math.min(maxY, value.y))};
}
