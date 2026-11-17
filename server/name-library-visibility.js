import { databasePool } from './name-request-store.js';
import { recordingUploadName } from '../src/lib/recordingUploadName.js';
export const visibilityKey = name => recordingUploadName(name).normalize('NFC').toLocaleLowerCase('en-GB');
export function createNameVisibility({pool=databasePool,now=Date.now}={}) {
 let cache,expires=0;
 return {
  async hidden({fresh=false}={}) {
   if(!fresh&&cache&&now()<expires)return cache;
   const result=await pool().query('SELECT name_key FROM santa_hidden_recordings');
   cache=new Set(result.rows.map(row=>row.name_key));expires=now()+10000;return cache;
  },
  async set(name,hidden) {
   const key=visibilityKey(name);
   if(hidden)await pool().query('INSERT INTO santa_hidden_recordings(name_key) VALUES($1) ON CONFLICT DO NOTHING',[key]);
   else await pool().query('DELETE FROM santa_hidden_recordings WHERE name_key=$1',[key]);
   cache=null;expires=0;
  }
 };
}
export const nameVisibility=createNameVisibility();
