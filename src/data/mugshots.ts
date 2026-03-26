export interface Mugshot {
  name: string;
  role: string;
  image: string;
  slug: string;
}

import mugshotsJson from './mugshots.json';

const mugshots: Mugshot[] = mugshotsJson as Mugshot[];

export default mugshots;
