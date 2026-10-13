/**
 * Client-side image compression before upload (keeps each photo well under the 2MB server limit).
 * Resizes to max 1600px on the long edge and lowers JPEG quality until the result is small enough.
 */
export async function compressImage(file: File, maxDim = 1600, maxBytes = 1_400_000): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Fadlan dooro sawir (JPG/PNG).');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Sawirka lama akhrin karo.'));
      i.src = url;
    });
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    let dim = maxDim;
    for (let pass = 0; pass < 4; pass++) {
      const scale = Math.min(1, dim / Math.max(w, h));
      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      for (const q of [0.82, 0.72, 0.62, 0.5]) {
        const data = canvas.toDataURL('image/jpeg', q);
        const bytes = Math.ceil(((data.length - data.indexOf(',') - 1) * 3) / 4);
        if (bytes <= maxBytes) return data;
      }
      dim = Math.round(dim * 0.75);
    }
    throw new Error('Sawirku aad buu u weyn yahay.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
