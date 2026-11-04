import us from './studio-regional-stories/us.js';
import england from './studio-regional-stories/england.js';
import scotland from './studio-regional-stories/scotland.js';
import wales from './studio-regional-stories/wales.js';
import northernIreland from './studio-regional-stories/northern-ireland.js';
import { workshopRegionalFolders } from '../src/lib/workshopDestinations.js';

const key = value => String(value).normalize('NFC').trim().toLocaleLowerCase('en-GB')
  .replace(/['’]/g, '’').replace(/\s+/g, ' ');
const definitions = {
  'usa-states': us, 'england-counties': england, 'scotland-counties': scotland,
  'wales-counties': wales, 'northern-ireland-counties': northernIreland,
};
// Explicit owner-hosted aliases, not fuzzy matching or spelling corrections to
// the recording catalogue. They only select private letter editorial context.
export const regionalAliases = {
  'usa-states': { 'south carolin': 'South Carolina', 'washington dc': 'District of Columbia' },
  'england-counties': { 'sle of wight': 'Isle of Wight', durham: 'County Durham' },
  'scotland-counties': { aberdeen: 'Aberdeen City', dundee: 'Dundee City', edinburgh: 'City of Edinburgh',
    glasgow: 'Glasgow City', 'the highlands': 'Highland' },
  'wales-counties': {},
  'northern-ireland-counties': { 'county antrim': 'Antrim', 'county armagh': 'Armagh',
    'county down': 'Down', 'county fermanagh': 'Fermanagh', 'county londonderry': 'Londonderry',
    derry: 'Londonderry', 'county tyrone': 'Tyrone' },
};
// Private source/review metadata never travels with the authorised choices.
// Source notes and the repeatable source checker explain the location checks.
export const regionalEditorialInventory = Object.fromEntries(Object.entries(definitions).map(([folder, rows]) =>
  [folder, Object.fromEntries(rows.map(([label, anchor, ...scenes]) => [key(label), {
    // The existing introduction already names the selected region and parent.
    // Do not repeat them: long regional labels must retain the A4 text budget.
    label, anchor, passages: scenes.map(scene => `In our pretend rehearsal, ${scene[0].toLocaleLowerCase('en-GB')}${scene.slice(1)}`),
  }]))]));

export function regionalEditorialContext(folder, parentFile, label) {
  if (!Object.hasOwn(workshopRegionalFolders, folder) || workshopRegionalFolders[folder] !== parentFile) {
    return { group: 'neutral', needsReview: true };
  }
  const normalised = key(label);
  const aliases = regionalAliases[folder];
  const canonical = Object.hasOwn(aliases, normalised) ? aliases[normalised] : normalised;
  const inventory = regionalEditorialInventory[folder];
  const entry = Object.hasOwn(inventory, key(canonical)) ? inventory[key(canonical)] : undefined;
  return entry ? { group: 'real', needsReview: false, regional: true, passages: entry.passages }
    : { group: 'neutral', needsReview: true };
}
