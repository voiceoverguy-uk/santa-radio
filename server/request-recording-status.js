import { santaNameKey } from '../src/lib/santaNameSearch.js';
let library;
async function liveCatalogue() {
  const { createNameLibrary } = await import('./santa-name-library.js');
  library ||= createNameLibrary();
  return library.catalogue();
}
// Read-only, exact recorded labels. Never changes request state or queues mail.
export async function requestRecordingStatus(requests, catalogue = liveCatalogue) {
  if (!requests.length) return requests;
  try {
    const records = await catalogue();
    const names = new Set(records.map(record => santaNameKey(record.name)));
    return requests.map(row => ({ ...row, recordingStatus: names.has(santaNameKey(row.name)) ? 'available' : 'not_found' }));
  } catch {
    return requests.map(row => ({ ...row, recordingStatus: 'unknown' }));
  }
}
