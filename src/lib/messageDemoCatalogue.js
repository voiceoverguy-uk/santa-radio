export const demoGroups = { free: 'Free', kids: 'Kids', dads: 'Dads' };
export const maxDemoBytes = 40 * 1024 * 1024;
const free = [
  ['boy', 'Harry'], ['girl', 'Arabella'], ['ayla', 'Ayla'], ['mohani', 'Mohani'], ['charlotte', 'Charlotte'],
].map(([id, name]) => ({ id, name, src: '/audio/examples/santa-message-' + id + '.mp3' }));
const kids = ['Charlotte', 'Harry', 'Edward', 'Arabella'].map(name => ({
  id: name.toLowerCase(), name, src: '/audio/examples/santa-studio-' + name.toLowerCase() + '.mp3',
  cues: name === 'Charlotte' ? [9, 18, 29, 38, 44, 54, 64, 80] : [9, 18, 29, 38, 45, 54, 64, 79],
}));
export const builtInDemos = { free, kids, dads: [] };
