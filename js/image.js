// Afbeeldingen klaarmaken voor opslag in de database.
// Er is geen bestandsopslag (gratis plan), dus een foto moet onder ±700 kB blijven.
// Kleine bestanden gaan ongewijzigd door; grote worden verkleind en als JPEG bewaard.

const MAX_BYTES = 700 * 1024;
const MAX_INPUT = 25 * 1024 * 1024;
export const ACCEPT = ['image/jpeg', 'image/png'];

const blobToDataUrl = (blob) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

async function decode(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Oudere browsers: via een <img>
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function draw(src, w, h, sx = 0, sy = 0, sw = src.width, sh = src.height) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; // doorzichtige png's krijgen een witte achtergrond
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
  return c;
}
const toJpeg = (canvas, q) => new Promise((res) => canvas.toBlob(res, 'image/jpeg', q));

// → { dataUrl, type, width, height, thumb, resized }
export async function prepareImage(file) {
  if (!ACCEPT.includes(file.type)) throw new Error('Kies een jpg- of png-bestand.');
  if (file.size > MAX_INPUT) throw new Error('Dit bestand is te groot (maximaal 25 MB).');

  let src;
  try { src = await decode(file); } catch { throw new Error('We konden deze afbeelding niet openen. Probeer een ander bestand.'); }
  const { width, height } = src;
  if (Math.min(width, height) < 200) throw new Error('Deze afbeelding is te klein. Kies er een van minstens 200 pixels breed en hoog.');

  // Vierkant miniatuurtje voor de bestellijst
  const side = Math.min(width, height);
  const thumb = draw(src, 96, 96, (width - side) / 2, (height - side) / 2, side, side).toDataURL('image/jpeg', 0.6);

  if (file.size <= MAX_BYTES) {
    return { dataUrl: await blobToDataUrl(file), type: file.type, width, height, thumb, resized: false };
  }

  for (const max of [1600, 1400, 1200, 1000, 800]) {
    const scale = Math.min(1, max / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const canvas = draw(src, w, h);
    for (const q of [0.86, 0.78, 0.7]) {
      const blob = await toJpeg(canvas, q);
      if (blob && blob.size <= MAX_BYTES) {
        return { dataUrl: await blobToDataUrl(blob), type: 'image/jpeg', width: w, height: h, thumb, resized: true };
      }
    }
  }
  throw new Error('We kregen deze afbeelding niet klein genoeg. Probeer een ander bestand.');
}
