'use client';

// Stamps a semi-transparent "Company Name • date time" label onto the
// bottom-left of a photo before it's uploaded — proof-of-work style, done
// entirely in the browser (canvas), no server round-trip needed.

const RAJ_PUMPS = process.env.NEXT_PUBLIC_RAJ_PUMPS || 'RO Service';

export async function watermarkImage(file: File): Promise<File> {
  // Only images can be watermarked this way — pass anything else through untouched.
  if (!file.type.startsWith('image/')) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(file); // no canvas support — fall back to the original photo
          return;
        }
        ctx.drawImage(img, 0, 0);

        const text = `${RAJ_PUMPS} • ${new Date().toLocaleString('en-IN')}`;
        const fontSize = Math.max(16, Math.round(canvas.width * 0.025));
        ctx.font = `${fontSize}px sans-serif`;
        const padding = fontSize * 0.6;
        const textWidth = ctx.measureText(text).width;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(0, canvas.height - fontSize - padding * 2, textWidth + padding * 2, fontSize + padding * 2);

        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, padding, canvas.height - fontSize / 2 - padding);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) {
              resolve(file);
              return;
            }
            resolve(new File([blob], file.name || 'photo.jpg', { type: 'image/jpeg' }));
          },
          'image/jpeg',
          0.9
        );
      } catch (e) {
        URL.revokeObjectURL(url);
        resolve(file); // any unexpected failure — don't block the upload over a watermark
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export async function watermarkImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map(watermarkImage));
}
