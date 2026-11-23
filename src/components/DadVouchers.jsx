import { useEffect, useState } from 'react';
export default function DadVouchers({ ownerToken }) {
  const [rows,setRows]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[copied,setCopied]=useState('');
  async function load(signal) {
    setBusy(true);
    try {
      const response=await fetch('/api/message-statistics?view=dad-vouchers',{headers:{Authorization:`Bearer studio-owner.${ownerToken}`},cache:'no-store',signal:signal||AbortSignal.timeout(15000)});
      const data=await response.json();
      if(!response.ok||!Array.isArray(data.vouchers))throw Error('Dad vouchers could not load. Please retry.');
      if(!signal?.aborted){setRows(data.vouchers);setError('');}
    }catch(e){if(!signal?.aborted)setError(e.message);}finally{if(!signal?.aborted)setBusy(false);}
  }
  useEffect(()=>{const controller=new AbortController();load(controller.signal);const timer=setInterval(()=>{if(!document.hidden)load(controller.signal);},30000);return()=>{controller.abort();clearInterval(timer);};},[ownerToken]);
  async function copy(row){try{await navigator.clipboard.writeText(row.code);setCopied(row.id);}catch{setError('Select and copy the code manually.');}}
  const active=rows.filter(row=>!row.redeemedAt),used=rows.filter(row=>row.redeemedAt);
  const table=(items)=><div className="santa-dashboard__table"><table><thead><tr><th>Code</th><th>Status</th><th>Used · UK time</th><th>Copy</th></tr></thead><tbody>{items.map(row=><tr key={row.id}><td><code>{row.code}</code></td><td><strong style={{color:row.redeemedAt?'#e6b8b8':'#bce5c1'}}>{row.status}</strong></td><td>{row.redeemedAt?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'}).format(new Date(row.redeemedAt)):'Not used'}</td><td>{!row.redeemedAt&&<button onClick={()=>copy(row)} aria-label={`Copy ${row.code}`}>{copied===row.id?'Copied!':'Copy'}</button>}</td></tr>)}</tbody></table></div>;
  return <section className="dashboard-themed dashboard-themed--gifts"><header className="dashboard-themed__header"><h2>Dad message vouchers</h2></header><p>15 active single-use codes, each for one Dad message. A replacement is created whenever a code is claimed.</p><p>Send a code with <a href="/dad-message-maker">Dad’s Message Maker</a>. Choose “Have a voucher or admin code?” to enter it. The recipient has 30 days to create their message in the same browser.</p><button onClick={()=>load()} disabled={busy}>{busy?'Checking vouchers…':'Refresh Dad vouchers'}</button>{error&&<p role="alert">{error}</p>}{copied&&<p role="status">Voucher copied.</p>}<h3>Active ({active.length})</h3>{table(active)}<h3>Used in the last five days ({used.length})</h3><p>Used means claimed. Used codes disappear from this list after five days and can never be reused.</p>{used.length?table(used):<p>No used codes in the last five days.</p>}</section>;
}
