import {useState} from 'react';
const pounds=p=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(p/100);
export default function PaidRevenueChart({daily}) {
  const [days,setDays]=useState(30),[selected,setSelected]=useState(null);
  if(!daily)return <p>Payment graph unavailable. Refresh figures to try again.</p>;
  const rows=daily.slice(-days),max=Math.max(1,...rows.map(row=>row.grossPence));
  const active=rows.find(row=>row.day===selected);
  return <div className="payment-chart">
    <div className="payment-chart__heading"><h3>Daily payments collected</h3><div aria-label="Payment chart period">{[7,30].map(n=><button key={n} type="button" aria-pressed={days===n} onClick={()=>{setDays(n);setSelected(null);}}>{n} days</button>)}</div></div>
    <p><strong>{pounds(rows.reduce((sum,row)=>sum+row.grossPence,0))}</strong> across {rows.reduce((sum,row)=>sum+row.payments,0)} payments in this period</p>
    <div className="payment-chart__scale">{pounds(max===1 && rows.every(row=>row.grossPence===0)?0:max)}</div>
    <div className="payment-chart__bars" role="group" aria-label="Daily payment amounts in pounds">{rows.map(row=><button key={row.day} className="payment-chart__bar" type="button" style={{height:`${Math.max(1,row.grossPence/max*100)}%`}} aria-label={`${row.day}: ${pounds(row.grossPence)}, ${row.payments} payments`} onFocus={()=>setSelected(row.day)} onMouseEnter={()=>setSelected(row.day)} onClick={()=>setSelected(row.day)}><span className="payment-chart__sr">{row.day}</span></button>)}</div>
    <div className="payment-chart__dates"><span>{rows[0]?.day}</span><span>{rows.at(-1)?.day}</span></div>
    <p className="payment-chart__detail" aria-live="polite">{active?`${active.day}: ${pounds(active.grossPence)} · ${active.payments} payments`:'Tap or focus a bar for its date, amount and payment count.'}</p>
    <p className="payment-chart__note">UK dates when payments were recorded by the website; today is partial. Actual amounts after discounts, before Stripe fees and refunds. This is money collected, not profit.</p>
  </div>;
}
