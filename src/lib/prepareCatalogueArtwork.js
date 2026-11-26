// Use JPEG for the upload so Safari and the other dashboard browsers encode the same format.
export async function prepareCatalogueArtwork(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) {
    throw new Error('Choose a JPG, PNG or WebP image up to 20 MB.');
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const size = Math.min(1024, side);
    if (!size) throw new Error();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    context.fillStyle = '#103629';
    context.fillRect(0, 0, size, size);
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, (image.naturalWidth-side)/2, (image.naturalHeight-side)/2, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.92);
  } catch {
    throw new Error('This image could not be opened. Choose another JPG, PNG or WebP.');
  } finally { URL.revokeObjectURL(url); }
}
