import { handleUploadPresigned } from '@vercel/blob/client';
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
async function uploadedMedia(key,ext) {
  const blob=await head(pathFor(key,ext));
  if(blob.contentType!==types[ext] || !blob.size || blob.size>limit(ext)) fail('The uploaded file could not be verified.');
  return new URL(blob.url).hostname.endsWith('.private.blob.vercel-storage.com') ? mediaRoute(key,ext) : blob.url;
}
export async function manageContenders(body, pool=databasePool()) {
  if (!body) return {entries:(await pool.query(`SELECT id,artist,title,audio,artwork,contact_name AS name,contact_email AS email,
    invitation_state AS state, invitation_sent_at AS "sentAt" FROM christmas_contenders_entries WHERE ${live} ORDER BY artist,title`,[COMPETITION])).rows};
  const {action,id,ext} = body;
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id || '')) fail('Select a valid song.');
  if(action==='publish' && (!/^song-[a-f0-9-]{36}$/.test(id) || !Object.hasOwn(types,ext))) fail('Choose a supported file.');
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
      const media=await Promise.all(['mp3',ext].map(suffix=>uploadedMedia(id,suffix)));
      await pool.query(`INSERT INTO christmas_contenders_entries(competition,id,mode,approved,artist,title,audio,artwork,contact_name,contact_email)
        VALUES($1,$2,'live',true,$3,$4,$5,$6,$7,$8) ON CONFLICT(competition,id) DO NOTHING`,[COMPETITION,id,artist,title,...media,name,email]);
    }
    return {ok:true};
  }
  if (action==='edit-song') {
    const artist=readText(body.artist,120,true), title=readText(body.title,160,true);
    const result=await pool.query(`UPDATE christmas_contenders_entries SET artist=$3,title=$4
      WHERE ${live} AND id=$2 AND ((artist=$5 AND title=$6) OR (artist=$3 AND title=$4))`,
      [COMPETITION,id,artist,title,body.previousArtist,body.previousTitle]);
    if (!result.rowCount) fail('The song details have changed. Refresh and check them before saving.',409);
    return {ok:true};
  }
  if (action === 'replace-audio' || action === 'replace-artwork') {
    const audio = action === 'replace-audio';
    const column = audio ? 'audio' : 'artwork';
    if (!/^song-[a-f0-9-]{36}$/.test(body.key) || typeof body.previous !== 'string' ||
        (!audio && !['jpg', 'png', 'webp'].includes(ext))) {
      fail(audio ? 'Choose a replacement MP3.' : 'Choose a replacement JPG, PNG or WebP.');
    }
    const url = await uploadedMedia(body.key, audio ? 'mp3' : ext);
    const result = await pool.query(`UPDATE christmas_contenders_entries SET ${column}=$3
      WHERE ${live} AND id=$2 AND ${column} IN ($3,$4)`, [COMPETITION, id, url, body.previous]);
    if (!result.rowCount) fail(`The ${audio ? 'recording' : 'artwork'} has changed. Refresh the dashboard before replacing it.`, 409);
    return {ok: true, [column]: url};
  }
  if(action!=='invite') fail('Unknown contender action.');
  if(!process.env.BREVO_API_KEY) fail('Brevo is not configured.',503);
  if (!/^poster-[a-f0-9-]{36}$/.test(body.poster || '')) fail('Refresh and try the invitation again.');
  const poster = await head(pathFor(body.poster, 'png'));
  if (poster.contentType !== 'image/png' || !poster.size) fail('The voting picture could not be verified.');
  const result=await pool.query(`UPDATE christmas_contenders_entries SET invitation_state='sending' WHERE ${live} AND id=$2
    AND contact_email<>'' AND contact_email=$3 AND invitation_state='ready' RETURNING artist,title,contact_name,contact_email`,[COMPETITION,id,body.email]);
  const row=result.rows[0];
  if(!row) fail('Refresh the entry and check its saved contact and invitation status.',409);
  const update=state=>pool.query(`UPDATE christmas_contenders_entries SET invitation_state=$3, invitation_sent_at=CASE WHEN $3='sent' THEN now() END
    WHERE ${live} AND id=$2 AND invitation_state='sending'`,[COMPETITION,id,state]);
  const url='https://www.santaradio.co.uk/christmas-contenders#'+encodeURIComponent(id);
  const picture='https://www.santaradio.co.uk/contenders/voting-picture.html?song='+encodeURIComponent(id);
  const escape = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const image = 'https://www.santaradio.co.uk/api/christmas-contenders?media=' + body.poster + '.png';
  const htmlContent = `<p>Hi ${escape(row.contact_name || row.artist)},</p>
<p>Thanks for sending us “${escape(row.title)}”. It’s now on Santa Radio’s Christmas Contenders voting page, listed under ${escape(row.artist)}!</p>
<p>Tell your friends, family and fans. They can listen to your song and vote for it here:<br><a href="${url}">${url}</a></p>
<p>Please share it on your social media too.</p>
<a href="${picture}"><img src="${image}" width="480" alt="Up vote ${escape(row.title)} by ${escape(row.artist)}" style="display:block;width:100%;max-width:480px;height:auto;border:0"></a>
<p><a href="${picture}">Download your personalised voting picture</a></p>
<p>Good luck and Merry Christmas!<br>Head Elf<br>Santa Radio</p>`;
  const response=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
    headers:{'api-key':process.env.BREVO_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({sender:{name:'Santa Radio',email:'santa@santaradio.co.uk'},to:[{email:row.contact_email}],
      htmlContent, subject:'Your song is in Santa Radio’s Christmas Contenders!',
      textContent:`Hi ${row.contact_name || row.artist},\n\nThanks for sending us “${row.title}”. It’s now on Santa Radio’s Christmas Contenders voting page, listed under ${row.artist}!\n\nTell your friends, family and fans. They can listen to your song and vote for it here:\n${url}\n\nPlease share it on your social media too. Download your personalised voting picture here:\n${picture}\n\nGood luck and Merry Christmas!\nHead Elf\nSanta Radio`})
  }).catch(()=>null);
  if(response?.ok && (await response.json().catch(()=>null))?.messageId) { await update('sent'); return {ok:true}; }
  if(response && response.status>=400 && response.status<500 && response.status!==408) { await update('ready'); fail('Brevo declined the email. Check the address and Brevo settings before retrying.',502); }
  fail('Delivery is unconfirmed. Check the Brevo transactional log before sending again.',502);
}

const mediaRoute=(id,ext)=>`/api/christmas-contenders?media=${id}.${ext}`;
export async function contenderMedia(file) {
  if (typeof file === 'string' && /^poster-[a-f0-9-]{36}\.png$/.test(file)) {
    const pathname = 'christmas-contenders/' + file;
    const signed = await issueSignedToken({pathname,operations:['get'],validUntil:Date.now()+3600000,token:process.env.BLOB_READ_WRITE_TOKEN});
    return (await presignUrl(signed,{pathname,operation:'get',access:'private'})).presignedUrl;
  }
  const match=typeof file==='string' && /^(song-[a-f0-9-]{36})\.(mp3|jpg|png|webp)$/.exec(file);
  if(!match) fail('Unknown media.',404);
  const [,id,ext]=match;
  const published=await databasePool().query(`SELECT 1 FROM christmas_contenders_entries WHERE ${live} AND $2 IN (audio,artwork)`,[COMPETITION,mediaRoute(id,ext)]);
  if(!published.rowCount) fail('Unknown media.',404);
  const pathname=pathFor(id,ext);
  const signed=await issueSignedToken({pathname,operations:['get'],validUntil:Date.now()+3600000,token:process.env.BLOB_READ_WRITE_TOKEN});
  return (await presignUrl(signed,{pathname,operation:'get',access:'private'})).presignedUrl;
}

export function signContenderUpload(req) {
  if(req.body?.type!=='blob.generate-presigned-url') fail('Invalid upload request.');
  return handleUploadPresigned({request:req,body:req.body,getSignedToken:async pathname=>{
    const match=/^christmas-contenders\/song-[a-f0-9-]{36}\.(mp3|jpg|png|webp)$/.exec(pathname);
    const poster=/^christmas-contenders\/poster-[a-f0-9-]{36}\.png$/.test(pathname);
    if(!match && !poster) fail('Choose a supported contender file.');
    const ext=poster ? 'png' : match[1];
    const constraints={pathname,operations:['put'],allowedContentTypes:[types[ext]],maximumSizeInBytes:limit(ext),validUntil:Date.now()+900000};
    return {token:await issueSignedToken(constraints),urlOptions:{allowOverwrite:false,addRandomSuffix:false}};
  }});
}
