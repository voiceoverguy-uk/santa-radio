export const demoGroups = { free: 'Free', kids: 'Kids', dads: 'Dads' };
export const maxDemoBytes = 100 * 1024 * 1024;

function film(id, name, base, extra = {}) {
  return {id, name, src:base + '.mp4', poster:base + '.jpg', ...extra};
}

export const builtInDemos = {
  free: ['01','02','03','04'].map(id => film(id, 'Free Santa example ' + Number(id), '/video/examples/free-santa-message-example-' + id)),
  kids: [film('charlotte','Charlotte','/videos/examples/santa-premium-charlotte-v3', {recipient:'Charlotte', cues:[11,20,31,41,46,60,70,86]})],
  dads: [film('simon','Simon','/videos/examples/dad-simon-v3', {recipient:'Simon', cues:[10,23,42,60,80,103]})],
};
