export interface Mugshot {
  artist: string;
  link: string;
  image: string;
  song: string;
  info?: string;
  credit?: string;
  socialUrl?: string;
}

import mugshotsJson from './mugshots.json';

const mugshots: Mugshot[] = mugshotsJson as Mugshot[];

export default mugshots;
