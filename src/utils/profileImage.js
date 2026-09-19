const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = 400000;
const MAX_DIMENSION = 900;

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to read this image.'));
    image.src = dataUrl;
  });
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read this image.'));
    reader.readAsDataURL(file);
  });
}

export async function compressShareProfileImage(file) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }
  if (Number(file.size) > MAX_SOURCE_BYTES) {
    throw new Error('Image is too large. Choose an image under 12 MB.');
  }

  const source = await readAsDataUrl(file);
  const image = await loadImage(source);
  const naturalWidth = Math.max(1, Number(image.naturalWidth || image.width) || 1);
  const naturalHeight = Math.max(1, Number(image.naturalHeight || image.height) || 1);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(naturalWidth, naturalHeight));
  let width = Math.max(1, Math.round(naturalWidth * scale));
  let height = Math.max(1, Math.round(naturalHeight * scale));

  for (const quality of [0.84, 0.76, 0.68, 0.60, 0.52]) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is unavailable.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, width, height);
    const result = canvas.toDataURL('image/jpeg', quality);
    if (result.length <= MAX_DATA_URL_LENGTH) return result;

    width = Math.max(1, Math.round(width * 0.88));
    height = Math.max(1, Math.round(height * 0.88));
  }

  throw new Error('Image could not be compressed enough. Choose a smaller photo.');
}

export { MAX_DATA_URL_LENGTH };
