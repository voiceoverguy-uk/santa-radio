import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import SantaTrackerClient from "@/components/SantaTrackerClient";
import "../../../tracker.css";

export const metadata = { robots: { index: false, follow: true } };

export default function SantaTrackerPreviewPage() {
  const [authorized,setAuthorized]=useState<boolean|null>(null);
  useEffect(()=>{let active=true;fetch('/api/tracker-preview-access',{cache:'no-store'}).then(r=>r.json()).then(data=>{if(active)setAuthorized(data.authorized===true);}).catch(()=>{if(active)setAuthorized(false);});return()=>{active=false;};},[]);
  return (
    <main className="santa-tracker">
      <Helmet>
        <title>Development Preview | Santa Tracker — Santa Radio</title>
        <meta name="robots" content="noindex, follow" />
        <meta name="description" content="Development-only Santa Tracker time-jump controls. Simulated dates do not affect the visitor tracker." />
      </Helmet>
      {authorized ? <SantaTrackerClient showPreview /> : <section style={{maxWidth:420,margin:'100px auto',padding:24}}>
        <h1>Santa Tracker Preview</h1>
        {authorized===null ? <p>Checking preview access…</p> : <form method="post" action="/api/tracker-preview-access">
          <label htmlFor="preview-password">Password</label>
          <input id="preview-password" name="password" type="password" autoComplete="current-password" required />
          <input type="hidden" name="postcards" value={typeof window!=='undefined' && new URLSearchParams(window.location.search).get('postcards')==='1'?'1':'0'} />
          <button type="submit">Unlock preview</button>
        </form>}
      </section>}
    </main>
  );
}
