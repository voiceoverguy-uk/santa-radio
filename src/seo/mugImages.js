export function mugThumbnail(image, width = 320) {
  return `/mugshot-thumbnails/${image.split('/').at(-1).replace(/\.[^.]+$/, '')}-${width}.webp`;
}
export function mugSrcSet(image) {
  return `${mugThumbnail(image, 320)} 320w, ${mugThumbnail(image, 640)} 640w`;
}
