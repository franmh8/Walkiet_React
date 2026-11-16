export function pickAvatar(source: 'camera' | 'library'): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp'; input.style.display = 'none'; input.setAttribute('aria-label', 'Seleccionar foto de perfil');
    if (source === 'camera') input.capture = 'user';
    const finish = () => input.remove();
    input.oncancel = () => { finish(); resolve(null); };
    input.onchange = async () => {
      const file = input.files?.[0]; finish(); if (!file) { resolve(null); return; }
      if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) { reject(new Error('Selecciona una foto JPEG, PNG o WebP de hasta 15 MB.')); return; }
      const url = URL.createObjectURL(file); const image = new Image();
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo abrir la foto.')); };
      image.onload = () => {
        try {
          const size = Math.min(image.naturalWidth, image.naturalHeight); const canvas = document.createElement('canvas'); canvas.width = canvas.height = 320;
          const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('El navegador no pudo preparar la foto.');
          ctx.drawImage(image, (image.naturalWidth-size)/2, (image.naturalHeight-size)/2, size, size, 0, 0, 320, 320);
          const data = canvas.toDataURL('image/jpeg', 0.72); if (data.length > 175000) throw new Error('La foto contiene demasiado detalle. Selecciona otra imagen.');
          resolve(data);
        } catch (cause) { reject(cause); } finally { URL.revokeObjectURL(url); }
      };
      image.src = url;
    };
    document.body.appendChild(input); input.click();
  });
}
