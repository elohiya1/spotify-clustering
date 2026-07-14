// Dominant-color extraction for the vinyl's dynamic accent. Cross-origin
// album art can taint the canvas and throw on getImageData — callers should
// always supply a fallback (the active cluster's color_swatch).
const cache = new Map<string, Promise<string>>();

export function extractDominantColor(imgUrl: string, fallback: string): Promise<string> {
  const cached = cache.get(imgUrl);
  if (cached) return cached;

  const promise = new Promise<string>(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(fallback);

        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha < 128) continue;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        if (count === 0) return resolve(fallback);

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        resolve(`rgb(${r}, ${g}, ${b})`);
      } catch {
        resolve(fallback);
      }
    };
    img.onerror = () => resolve(fallback);
    img.src = imgUrl;
  });

  cache.set(imgUrl, promise);
  return promise;
}
