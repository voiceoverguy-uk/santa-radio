export const demoGroups = { free: 'Free', kids: 'Kids', dads: 'Dads' };
export const maxDemoBytes = 100 * 1024 * 1024;

function film(id, name, base, extra = {}) {
  return {id, name, src:base + '.mp4', poster:base + '.jpg', ...extra};
}

const kidsMoments = {
  '01': [12, 20, 31, 40, 46, 59, 70, 86],
  '02': [12, 20, 31, 42, 47, 60, 70, 87],
};

export const builtInDemos = {
  free: ['01','02','03','04'].map(id => film(id, 'Free Santa example ' + Number(id), '/video/examples/free-santa-message-example-' + id)),
  kids: ['01','02'].map(id => film(id, 'Kids’ example ' + Number(id), '/videos/examples/santa-bespoke-message-example-' + id, {shortName:'Example ' + Number(id), cues:kidsMoments[id]})),
  dads: [film('simon','Simon','/videos/examples/dad-simon-v3', {recipient:'Simon', label:'Watch an example message for Dad', cues:[10,23,42,60,80,103]})],
};
