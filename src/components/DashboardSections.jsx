import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BookOpen, ClipboardList, Film, Gamepad2, Images, LayoutDashboard, Link2, Mail, Megaphone, MessageSquare, Music2, Smartphone, Tags, Ticket } from 'lucide-react';
import './DashboardSections.css';

const messageTools = [
  ['studio-takings', 'Studio takings'],
  ['free-message-activity', 'Free-message activity'], ['big-stitcher-title', 'The Big Stitcher'],
  ['dad-recording-support', 'Dad recording support'],
];

const sections = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, anchors: ['stats-overview', 'website-visitors-title'] },
  { id: 'message-maker', label: 'Message Maker', icon: Mail, anchors: messageTools.map(([id]) => id) },
  { id: 'vouchers', label: 'Dads & Kids Vouchers', icon: Ticket, anchors: ['voucher-heading'] },
  { id: 'video-stitcher', label: 'Video stitcher', icon: Film, anchors: [] },
  { id: 'demo-videos', label: 'Message demo videos', icon: Film, anchors: ['message-demos'] },
  { id: 'message-reviews', label: 'Santa message reviews', icon: MessageSquare, anchors: [] },
  { id: 'names-recordings', label: 'Names & recordings', icon: BookOpen, anchors: ['name-requests', 'recording-uploads', 'request-ledger'] },
  { id: 'popular-names', label: 'Popular names', icon: Tags, anchors: [] },
  { id: 'christmas-contenders', label: 'Christmas Contenders', icon: Music2, anchors: ['contender-votes'] },
  { id: 'artwork', label: 'Artist & song artwork', icon: Images, anchors: ['catalogue-artwork', 'catalogue-art-title'] },
  { id: 'artist-backgrounds', label: 'Artist backgrounds', icon: BookOpen, anchors: ['artist-background-title'] },
  { id: 'apps', label: 'Apps & downloads', icon: Smartphone, anchors: ['app-store-reports'] },
  { id: 'app-welcome-banners', label: 'App welcome banners', icon: Megaphone, anchors: ['banner-library'] },
  { id: 'games', label: 'Games & certificates', icon: Gamepad2, anchors: ['checker-downloads', 'game-figures'] },
  { id: 'dashboard-todos', label: 'To-do list', icon: ClipboardList, anchors: [] },
  { id: 'admin', label: 'Links & admin', icon: Link2, anchors: ['dashboard-links-title', 'website-email-totals'] },
];

function subscribe(listener) {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}
export function useDashboardAnchor() {
  return useSyncExternalStore(subscribe, () => window.location.hash.slice(1), () => '');
}

const ActiveSection = createContext('overview');

export function DashboardSections({ anchor, children }) {
  const current = sections.find(s => s.id === anchor || s.anchors.includes(anchor)) ?? sections[0];
  const content = useRef(null);
  useEffect(() => {
    // A bookmark can point into a panel that did not exist until the dashboard unlocked.
    if (!anchor) return;
    const target = document.getElementById(anchor);
    if (!target || !content.current?.contains(target)) return;
    if (target.tagName === 'DETAILS') target.open = true;
    if (document.activeElement === document.body || document.activeElement?.closest('[hidden]')) {
      if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
    target.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [anchor]);
  return <div className="dashboard-sections">
    <nav className="dashboard-sections__nav" aria-label="Dashboard sections">
      <div className="dashboard-sections__links">
        {sections.map(({ id, label, icon: Icon }) =>
          <a key={id} href={'#' + id} aria-current={id === current.id ? 'page' : undefined}>
            <Icon size={18} aria-hidden="true" /><span>{label}</span>
          </a>)}
      </div>
      <label className="dashboard-sections__picker">Dashboard section
        <select value={current.id} onChange={event => { window.location.hash = event.target.value; }}>
          {sections.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
    </nav>
    <div className="dashboard-sections__content" ref={content}>
      <ActiveSection.Provider value={current.id}>{children}</ActiveSection.Provider>
    </div>
  </div>;
}

export function DashboardPanel({ id, children }) {
  const active = useContext(ActiveSection) === id;
  return <DashboardPane id={id} active={active}>{children}</DashboardPane>;
}

// Keep drafts, selected files and ongoing jobs alive after a section has been opened.
export function DashboardPane({ id, active, children }) {
  const [visited, setVisited] = useState(active);
  const panel = useRef(null);
  useEffect(() => {
    if (active) setVisited(true);
    else panel.current?.querySelectorAll('audio, video').forEach(media => { if (!media.paused) media.pause(); });
  }, [active]);
  return <div id={id} ref={panel} hidden={!active} className="dashboard-sections__panel" tabIndex={-1}>
    {(active || visited) && children}
  </div>;
}

export function MessageMakerShortcuts() {
  return <nav className="dashboard-sections__shortcuts" aria-label="Message Maker tools">
    <a href="#vouchers">Vouchers</a>
    <a href="#demo-videos">Demo videos</a>
    <a href="#video-stitcher">Video stitcher</a>
    <a href="#message-reviews">Reviews</a>
    {messageTools.map(([id, label]) => <a key={id} href={'#' + id}>{label}</a>)}
  </nav>;
}
