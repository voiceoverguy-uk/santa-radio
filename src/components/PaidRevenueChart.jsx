import {useId,useState} from 'react';
const pounds=p=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(p/100);
const paymentDate=day=>day?new Date(day+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}):'';
export default function PaidRevenueChart({daily}) {
  const [days,setDays]=useState(30),[selected,setSelected]=useState(null);
  const tooltipId=useId();
  if(!daily)return <p>Payment graph unavailable. Refresh figures to try again.</p>;
  const rows=days===0?daily.slice(Math.max(0,daily.findIndex(row=>row.payments>0))):daily.slice(-days),max=Math.max(1,...rows.map(row=>row.grossPence));
  const active=rows.find(row=>row.day===selected);
  return <div className="payment-chart">
    <div className="payment-chart__heading"><h3>Daily payments collected</h3><div aria-label="Payment chart period">{[7,30,0].map(n=><button key={n} type="button" aria-pressed={days===n} onClick={()=>{setDays(n);setSelected(null);}}>{n===0?'All time':`${n} days`}</button>)}</div></div>
    <p><strong>{pounds(rows.reduce((sum,row)=>sum+row.grossPence,0))}</strong> across {rows.reduce((sum,row)=>sum+row.payments,0)} payments in this period</p>
    <div className="payment-chart__scale">{pounds(max===1 && rows.every(row=>row.grossPence===0)?0:max)}</div>
    <div className="payment-chart__bars" role="group" aria-label="Daily payment amounts in pounds">{rows.map((row,index)=><button key={row.day} className="payment-chart__bar" type="button" style={{height:`${Math.max(1,row.grossPence/max*100)}%`}} aria-label={`${paymentDate(row.day)}: ${pounds(row.grossPence)}, ${row.payments} payments`} aria-describedby={selected===row.day?tooltipId:undefined} onFocus={()=>setSelected(row.day)} onBlur={()=>setSelected(null)} onMouseEnter={()=>setSelected(row.day)} onMouseLeave={()=>setSelected(null)} onKeyDown={event=>{if(event.key==='Escape')setSelected(null);}} onClick={()=>setSelected(row.day)}><span className="payment-chart__sr">{paymentDate(row.day)}</span>{selected===row.day && <span id={tooltipId} role="tooltip" className={`payment-chart__tooltip ${index<3?'payment-chart__tooltip--start':index>=rows.length-3?'payment-chart__tooltip--end':''}`}><span>{paymentDate(row.day)}</span><strong>{pounds(row.grossPence)}</strong><span>{row.payments} {row.payments===1?'payment':'payments'}</span></span>}</button>)}</div>
    <div className="payment-chart__dates"><span>{paymentDate(rows[0]?.day)}</span><span>{paymentDate(rows.at(-1)?.day)}</span></div>
    <p className="payment-chart__detail" aria-live="polite">{active?`${paymentDate(active.day)}: ${pounds(active.grossPence)} · ${active.payments} payments`:'Tap or focus a bar for its date, amount and payment count.'}</p>
    <p className="payment-chart__note">UK dates when payments were recorded by the website; today is partial. Actual amounts after discounts, before Stripe fees and refunds. This is money collected, not profit.</p>
  </div>;
}
