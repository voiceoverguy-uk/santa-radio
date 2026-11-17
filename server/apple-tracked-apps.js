// Explicit owner-selected listings. Mac Santa Radio is a separate Apple app ID.
export const TRACKED_APPS = [
 ['1196349863','Fireplace Christmas Radio'], ['1025312198','Santa Radio · Mac'],
 ['1057048397','Santa Dash: Back to the Grotto'], ['586387813','Santa Voicemail'],
 ['1021183593','Santa Radio'], ['1157967613','Christmas Radio UK'],
 ['6832577400','Naughty or Nice List Checker'], ['6827331248','Santas Big Snowballs'],
 ['6832399619','Christmas Music for Shops'], ['6832646215','The Santa Tracker'],
 ['6830570614','Just Ask Santa'], ['1024535991','Santa Text'],
].map(([id,name])=>({id,name,icon:`/images/dashboard-apps/${id}.png`}));
export function releaseStatus(versions) {
  const states=versions.map(v=>v.attributes.appStoreState);
  if (states.some(s=>['READY_FOR_SALE','READY_FOR_DISTRIBUTION','REPLACED_WITH_NEW_VERSION'].includes(s))) return 'released';
  return states.length ? 'pending' : 'unknown';
}
