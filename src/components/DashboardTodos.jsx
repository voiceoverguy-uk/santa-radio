import './DashboardTodos.css';
import { useEffect, useRef, useState } from 'react';
export default function DashboardTodos({ownerToken}) {
  const [tasks,setTasks]=useState([]),[title,setTitle]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [loaded,setLoaded]=useState(false),[showCompleted,setShowCompleted]=useState(false);
  const alive=useRef(true),submission=useRef(null);
  async function request(body) {
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/message-statistics?view=todos',{method:body?'PATCH':'GET',headers:{Authorization:`Bearer studio-owner.${ownerToken}`,'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(20000),...(body?{body:JSON.stringify(body)}:{})});
      const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to save your list.');
      if(alive.current){setTasks(result.tasks);setLoaded(true);}return true;
    } catch(e){if(alive.current)setError(e.message);return false;}finally{if(alive.current)setBusy(false);}
  }
  useEffect(()=>{alive.current=true;request();return()=>{alive.current=false;};},[ownerToken]);
  async function add(e){e.preventDefault();if(busy||!title.trim())return;submission.current ||= crypto.randomUUID();if(await request({action:'add',id:submission.current,title:title.trim()})){setTitle('');submission.current=null;}}
  const completed=tasks.filter(t=>t.completedAt).length;
  return <section className="dashboard-todos"><h2>To-do list</h2><p>Ideas and improvements to add. Tick an item when it’s complete; untick it to reopen.</p>
    <form onSubmit={add}><label htmlFor="dashboard-new-task">New task or idea</label><textarea id="dashboard-new-task" value={title} onChange={e=>{setTitle(e.target.value);submission.current=null;}} maxLength={300} rows={2} disabled={busy} style={{width:'100%',boxSizing:'border-box'}}/><button disabled={busy||!title.trim()}>Add to list</button></form>
    {error&&<p role="alert">{error}</p>}{busy&&<p role="status">Updating to-do list…</p>}
    <p>{tasks.length-completed} to do · {completed} completed</p>
    <label className="dashboard-todos__filter"><span>Show completed</span><input type="checkbox" checked={showCompleted} onChange={e=>setShowCompleted(e.target.checked)}/></label>
    {tasks.filter(t=>showCompleted||!t.completedAt).map(task=><label key={task.id} className="dashboard-todos__item"><span style={{textDecoration:task.completedAt?'line-through':'none'}}>{task.title}</span><input type="checkbox" checked={!!task.completedAt} disabled={busy} onChange={e=>request({action:'complete',id:task.id,completed:String(e.target.checked)})}/></label>)}
    {loaded&&!tasks.length&&<p>No tasks yet. Add your first idea above.</p>}
    <button type="button" disabled={busy} onClick={()=>request()}>Refresh list</button>
  </section>;
}
