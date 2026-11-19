// Isolated PostgreSQL-compatible WASM fixture; never reads DATABASE_URL.
import {studioTestDatabase} from './studio-live-postgres.mjs';
export async function dadTestDatabase(){
 if(!process.env.DAD_TEST_PGLITE_MODULE)return studioTestDatabase({loadSchema:false});
 const {PGlite}=await import(process.env.DAD_TEST_PGLITE_MODULE);
 const db=new PGlite();let queue=Promise.resolve();
 const query=async(sql,values)=>{const r=values?await db.query(sql,values):sql.includes(';')?(await db.exec(sql)).at(-1):await db.query(sql);return {...r,rowCount:r.affectedRows??r.rows?.length??0};};
 return {pool:{query,connect:async()=>{let release;const prior=queue;queue=new Promise(r=>release=r);await prior;return{query,release};}},close:()=>db.close()};
}
