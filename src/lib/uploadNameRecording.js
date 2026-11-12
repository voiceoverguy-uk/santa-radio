import { recordingUploadName } from './recordingUploadName.js';
export function uploadNameRecording(row, token, {signal,onProgress=()=>{},createXHR=()=>new XMLHttpRequest()}={}) {
  return new Promise((resolve,reject)=>{
    const xhr=createXHR();
    const abort=()=>xhr.abort();
    const done=(error,result)=>{signal?.removeEventListener('abort',abort);error?reject(error):resolve(result);};
    if(signal?.aborted){reject(new Error('Upload cancelled.'));return;}
    xhr.open('POST','/api/name-recording-uploads');xhr.timeout=60000;
    xhr.setRequestHeader('Authorization',`Bearer studio-owner.${token}`);
    xhr.setRequestHeader('Content-Type','application/octet-stream');
    xhr.setRequestHeader('X-Recording-Name',encodeURIComponent(recordingUploadName(row.name)));
    xhr.setRequestHeader('X-Recording-Format',row.ext);
    xhr.upload.onprogress=event=>{if(event.lengthComputable)onProgress(Math.min(100,Math.round(event.loaded/event.total*100)));};
    xhr.upload.onload=()=>onProgress(100);
    xhr.onload=()=>{
      let body;try{body=JSON.parse(xhr.responseText);}catch{done(new Error('Unexpected response. Refresh saved recordings before retrying.'));return;}
      if(xhr.status<200||xhr.status>=300){done(new Error(body.error||'Upload failed. Please retry.'));return;}
      if(body.status!=='testing'||!body.path){done(new Error('Save was not confirmed. Refresh saved recordings before retrying.'));return;}
      done(null,body);
    };
    xhr.onerror=()=>done(new Error('Connection interrupted. Refresh saved recordings before retrying.'));
    xhr.ontimeout=()=>done(new Error('Upload timed out. Refresh saved recordings before retrying.'));
    xhr.onabort=()=>done(new Error('Upload cancelled.'));
    signal?.addEventListener('abort',abort,{once:true});xhr.send(row.file);
  });
}
