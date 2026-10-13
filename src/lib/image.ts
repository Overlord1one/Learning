/** Read an image file and downscale it so it fits comfortably into local storage. */
export async function fileToCompressedDataUrl(file: File, maxSize = 480): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Bitte wähle eine Bilddatei.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Das Bild ist zu groß (max. 10 MB).');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Das Bild konnte nicht gelesen werden.'));
      el.src = url;
    });
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Bildverarbeitung nicht verfügbar.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const webp = canvas.toDataURL('image/webp', 0.82);
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}
