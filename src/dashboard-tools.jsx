import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import CatalogueArtworkManager from './components/CatalogueArtworkManager.jsx';
import ContenderManager from './components/ContenderManager.jsx';
import DadRecordingSupport from './components/DadRecordingSupport.jsx';
import StatsOverview from './components/StatsOverview.jsx';
import useDashboardReport from './hooks/useDashboardReport.js';
import DashboardUsefulLinks from './components/DashboardUsefulLinks.jsx';
import FriendVouchers from './components/FriendVouchers.jsx';
import SantaRequestLedger from './components/SantaRequestLedger.jsx';
import './pages/SantaDashboard.css';

const tool = new URLSearchParams(location.search).get('tool');
const sections = ['contenders', 'vouchers', 'dad-support', 'useful-links', 'ledger'];

function AppStats({ token }) {
  const [revision, setRevision] = useState(0);
  const main = useDashboardReport(token, '', revision);
  const visitors = useDashboardReport(token, 'visitors', revision);
  const android = useDashboardReport(token, 'android-installs', revision);
  return <>
    {main.report ? <StatsOverview data={main.report} visitors={visitors} android={android} /> :
      <p role="status">{main.error ? 'Dashboard figures are unavailable.' : 'Loading dashboard figures…'}</p>}
    {main.report && main.error && <p role="status">Refresh failed. Showing the last fetched figures.</p>}
    <button type="button" onClick={() => setRevision(n => n + 1)}>Refresh figures</button>
  </>;
}

function DashboardTool() {
  const [statsOpen, setStatsOpen] = useState(false);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const bridge = window.webkit?.messageHandlers.dashboardTool;
    if (!sections.includes(tool) || !bridge) {
      setError('Open this tool from your Santa Dashboard app.');
    } else {
      bridge.postMessage('unlock').then(value => {
        if (!active) return;
        if (typeof value === 'string' && value) setToken(value);
        else setError('Unlock the dashboard and open this tool again.');
      }).catch(() => { if (active) setError('Unlock the dashboard and open this tool again.'); });
    }
    return () => { active = false; };
  }, []);

  if (!token) return <main className="santa-dashboard"><p role="status">{error || 'Opening dashboard tool…'}</p></main>;
  if (tool === 'ledger') return <SantaRequestLedger ownerToken={token} email="Studio owner"
    onSignOut={() => window.webkit.messageHandlers.dashboardTool.postMessage('close')} />;
  return <main className="santa-dashboard">
    {tool === 'contenders' && <ContenderManager ownerToken={token} onPublish={() => {}} />}
    {tool === 'dad-support' && <DadRecordingSupport ownerToken={token} />}
    {tool === 'useful-links' && <><details className="stats-app-tool" onToggle={event => setStatsOpen(event.currentTarget.open)}>
      <summary>Stats overview</summary>{statsOpen && <AppStats token={token} />}
    </details><DashboardUsefulLinks /><CatalogueArtworkManager ownerToken={token} /></>}
    {(tool === 'vouchers' || tool === 'useful-links') && <FriendVouchers ownerToken={token} />}
  </main>;
}

createRoot(document.getElementById('root')).render(<BrowserRouter><DashboardTool /></BrowserRouter>);
