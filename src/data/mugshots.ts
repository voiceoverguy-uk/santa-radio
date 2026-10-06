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
import { buildCatalogue } from './mugshot-catalogue.js';

const result = buildCatalogue(mugshotsJson);
const mugshots: Mugshot[] = result.catalogue;
export const mugshotAliases = result.aliases;

export default mugshots;
