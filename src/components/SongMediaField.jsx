import { songMediaSlug } from '../lib/songMediaName.js';
import { useState } from 'react';
import { uploadPresigned } from '@vercel/blob/client';

export default function SongMediaField({audio,value,onChange,busy,onBusy,error,artist,title}) {
  const [notice,setNotice]=useState('');
  const [uploaded,setUploaded]=useState('');
  const name=audio?'audioLink':'artworkLink';
  const maximum=audio?10:4;
  const formats=audio?{mp3:'audio/mpeg'}:{jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
  async function choose(event) {
    const file=event.target.files[0];
    event.target.value='';
    if (!file) return;
    const ext=file.name.split('.').pop().toLowerCase();
    if (!Object.hasOwn(formats,ext) || !file.size || file.size>maximum*1024*1024) {
      setNotice('Choose a supported file up to '+maximum+' MB.');return;
    }
    onBusy(true);setNotice('Uploading '+file.name+'…');
    try {
      const key=crypto.randomUUID().replaceAll('-','')+'.'+(ext==='jpeg'?'jpg':ext);
      await uploadPresigned('song-submissions/'+key,file,{handleUploadUrl:'/api/song-media',
        access:'private',contentType:formats[ext],multipart:false,
        onUploadProgress:({percentage})=>setNotice('Uploading '+file.name+' — '+Math.round(percentage)+'%')});
      onChange(window.location.origin+'/api/song-media?file='+key);
      setUploaded(ext === 'jpeg' ? 'jpg' : ext);setNotice('');
    } catch {setNotice('Upload failed. Please try again.');}
    finally {onBusy(false);}
  }
  return <div className="song-field">
    <label>{audio?'Upload MP3':'Upload artwork'} ({maximum} MB max)
      <input type="file" accept={Object.keys(formats).map(ext=>'.'+ext).join(',')} name={name} disabled={busy} onChange={choose} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined}/>
    </label>
    <p role="status">{notice || (uploaded && value ? 'Uploaded: '+songMediaSlug(artist,title)+'.'+uploaded : '')}</p>
    {uploaded && value && <button type="button" disabled={busy} onClick={()=>{onChange('');setUploaded('');setNotice('');}}>Remove {audio?'MP3':'artwork'}</button>}
    {error && <p id={`${name}-error`} className="song-field-error">{error}</p>}
  </div>;
}
