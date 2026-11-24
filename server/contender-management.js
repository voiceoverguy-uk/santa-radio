import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { head, issueSignedToken, presignUrl } from '@vercel/blob';
import { databasePool } from './contenders-database.js';
import { COMPETITION } from '../src/lib/contenders.js';
import { normalizeVotingEmail } from './contender-consent.js';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const live = "competition=$1 AND mode='live' AND approved";
const types = { mp3:'audio/mpeg', jpg:'image/jpeg', png:'image/png', webp:'image/webp' };
const limit = ext => (ext === 'mp3' ? 40 : 10) * 1024 * 1024;
const pathFor = (id, ext) => `christmas-contenders/${id}.${ext}`;
const readText = (value, max, required=false) => {
  if (typeof value !== 'string' || value.trim().length > max || /[\x00-\x1f]/.test(value) || (required && !value.trim())) fail('Check the song and contact details.');
  return value.trim();
};
export async function manageContenders(body, pool=databasePool()) {
  if (!body) return {entries:(await pool.query(`SELECT id,artist,title,contact_name AS name,contact_email AS email,
    invitation_state AS state, invitation_sent_at AS "sentAt" FROM christmas_contenders_entries WHERE ${live} ORDER BY artist,title`,[COMPETITION])).rows};
  const {action,id,ext} = body;
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id || '')) fail('Select a valid song.');
  if (action === 'upload' || action === 'publish') {
    const token = process.env.CONTENDERS_BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) fail('Connect a public Blob store for contender uploads.',503);
    if (!/^song-[a-f0-9-]{36}$/.test(id) || !Object.hasOwn(types,ext)) fail('Choose a supported file.');
    if (action==='upload') {
      const pathname=pathFor(id,ext);
      return {pathname,access:process.env.CONTENDERS_BLOB_READ_WRITE_TOKEN ? 'public' : 'private',token:await generateClientTokenFromReadWriteToken({token,pathname,allowedContentTypes:[types[ext]],maximumSizeInBytes:limit(ext),validUntil:Date.now()+900000})};
    }
  }
  if (action==='contact' || action==='publish') {
    const name=readText(body.name,120), raw=readText(body.email,254);
    const email=raw ? normalizeVotingEmail(raw) : '';
    if(raw && !email) fail('Enter a valid contact email.');
    if(action==='contact') {
      const result=await pool.query(`UPDATE christmas_contenders_entries SET contact_name=$3,contact_email=$4,
      invitation_state=CASE WHEN contact_email<>$4 THEN 'ready' ELSE invitation_state END,
      invitation_sent_at=CASE WHEN contact_email<>$4 THEN NULL ELSE invitation_sent_at END
      WHERE ${live} AND id=$2 AND (invitation_state<>'sending' OR contact_email=$4)`,[COMPETITION,id,name,email]);
      if(!result.rowCount) fail('Refresh the entry and check its email status.',409);
    } else {
      const artist=readText(body.artist,120,true), title=readText(body.title,160,true);
      if(ext==='mp3') fail('Choose artwork.');
      const media=await Promise.all(['mp3',ext].map(async suffix=>{
        const blob=await head(pathFor(id,suffix),{token:process.env.CONTENDERS_BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN});
        if(blob.contentType!==types[suffix] || !blob.size || blob.size>limit(suffix)) fail('Check the uploaded files and public storage settings.');
        return new URL(blob.url).hostname.endsWith('.private.blob.vercel-storage.com') ? mediaRoute(id,suffix) : blob.url;
      }));
      await pool.query(`INSERT INTO christmas_contenders_entries(competition,id,mode,approved,artist,title,audio,artwork,contact_name,contact_email)
        VALUES($1,$2,'live',true,$3,$4,$5,$6,$7,$8) ON CONFLICT(competition,id) DO NOTHING`,[COMPETITION,id,artist,title,...media,name,email]);
    }
    return {ok:true};
  }
  if(action!=='invite') fail('Unknown contender action.');
  if(!process.env.BREVO_API_KEY) fail('Brevo is not configured.',503);
  const result=await pool.query(`UPDATE christmas_contenders_entries SET invitation_state='sending' WHERE ${live} AND id=$2
    AND contact_email<>'' AND contact_email=$3 AND invitation_state='ready' RETURNING artist,title,contact_name,contact_email`,[COMPETITION,id,body.email]);
  const row=result.rows[0];
  if(!row) fail('Refresh the entry and check its saved contact and invitation status.',409);
  const update=state=>pool.query(`UPDATE christmas_contenders_entries SET invitation_state=$3, invitation_sent_at=CASE WHEN $3='sent' THEN now() END
    WHERE ${live} AND id=$2 AND invitation_state='sending'`,[COMPETITION,id,state]);
  const url='https://www.santaradio.co.uk/christmas-contenders';
  const response=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
    headers:{'api-key':process.env.BREVO_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({sender:{name:'Santa Radio',email:'santa@santaradio.co.uk'},to:[{email:row.contact_email}],
      subject:'Your song is in Santa Radio’s Christmas Contenders!',
      textContent:`Hi ${row.contact_name || row.artist},\n\nThanks for sending us “${row.title}”. It’s now on Santa Radio’s Christmas Contenders voting page, listed under ${row.artist}!\n\nTell your friends, family and fans. They can listen to your song and vote for it here:\n${url}\n\nGood luck and Merry Christmas!\nGuy and Mark\nSanta Radio`})
  }).catch(()=>null);
  if(response?.ok && (await response.json().catch(()=>null))?.messageId) { await update('sent'); return {ok:true}; }
  if(response && response.status>=400 && response.status<500 && response.status!==408) { await update('ready'); fail('Brevo declined the email. Check the address and Brevo settings before retrying.',502); }
  fail('Delivery is unconfirmed. Check the Brevo transactional log before sending again.',502);
}

const mediaRoute=(id,ext)=>`/api/christmas-contenders?media=${id}.${ext}`;
export async function contenderMedia(file) {
  const match=typeof file==='string' && /^(song-[a-f0-9-]{36})\.(mp3|jpg|png|webp)$/.exec(file);
  if(!match) fail('Unknown media.',404);
  const [,id,ext]=match;
  const published=await databasePool().query(`SELECT 1 FROM christmas_contenders_entries WHERE ${live} AND id=$2 AND $3 IN (audio,artwork)`,[COMPETITION,id,mediaRoute(id,ext)]);
  if(!published.rowCount) fail('Unknown media.',404);
  const pathname=pathFor(id,ext);
  const signed=await issueSignedToken({pathname,operations:['get'],validUntil:Date.now()+3600000,token:process.env.BLOB_READ_WRITE_TOKEN});
  return (await presignUrl(signed,{pathname,operation:'get',access:'private'})).presignedUrl;
}
