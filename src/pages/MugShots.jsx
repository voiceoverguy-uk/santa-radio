import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import './MugShots.css';
import './MugshotPhoto.css';
import mugshotsData from '../data/mugshots.ts';

const ITEMS_PER_PAGE = 100;

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const colors = ['#1B4332','#254c3a','#365642','#7c242b'];

export default function MugShots() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState('random');
  const [randomOrder] = useState(() => {
    const shuffled = [...mugshotsData];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });
  const alphabetical = useMemo(() => [...mugshotsData].sort((a, b) =>
    a.artist.localeCompare(b.artist, 'en', { sensitivity: 'base', numeric: true })), []);

  const filtered = useMemo(() => {
    const ordered = order === 'random' ? randomOrder : alphabetical;
    if (!search.trim()) return ordered;
    const q = search.trim().toLowerCase();
    return ordered.filter(c =>
      c.searchNames.some(name => name.toLowerCase().includes(q)) ||
      c.link.toLowerCase().includes(q)
    );
  }, [search, order, randomOrder, alphabetical]);

  const visible = filtered.slice(0, page * ITEMS_PER_PAGE);
  const hasMore = page * ITEMS_PER_PAGE < filtered.length;

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  return (
    <main>
      <Helmet>
        <title>Celebrity Mug Shots {'\u2013'} Santa Radio</title>
        <meta name="description" content="Santa Radio Celebrity Mug Shots Hall of Fame! Hundreds of famous faces from TV, radio, music, comedy and sport, all posing with the iconic Santa Radio mug." />
        <meta property="og:title" content="Celebrity Mug Shots – Santa Radio" />
        <meta property="og:description" content="Santa Radio Celebrity Mug Shots Hall of Fame! Hundreds of famous faces from TV, radio, music, comedy and sport." />
        <meta property="og:url" content="https://www.santaradio.co.uk/mugshots/all" />
        <meta name="twitter:card" content="summary" />
        <link rel="canonical" href="https://www.santaradio.co.uk/mugshots/all" />
      </Helmet>
      <div className="mugshots-page-hero starry-bg">
        <div className="mugshots-hero-content">
          <div className="mugshots-page-logo-wrap">
            <img
              src="https://www.santaradio.co.uk/santa-radio-celebrity-mugshots.png"
              alt="Mug Shots"
              className="mugshots-page-logo"
              onError={e => { e.target.style.display = 'none'; }}
            />
          </div>
          <h1 className="mugshots-page-title">Santa Radio Celebrity Mug Shots Hall of Fame!</h1>
          <p className="mugshots-page-sub">
            <strong>Ecurb the Elf has been out and about door stopping celebrities with our Santa Radio Mug!</strong>
          </p>
          <p className="mugshots-page-desc">
            Santa Radio{'\u2019'}s celebrity mug shots feature hundreds of famous faces from TV, radio, music, comedy and
            sport, all proudly posing with the iconic Santa Radio mug.
          </p>
          <p className="mugshots-count">
            <span className="count-num">{mugshotsData.length}</span> Celebrity Mugshots and Counting...
          </p>
          <input
            type="text"
            aria-label="Search celebrity names or roles"
            className="mugshots-search"
            placeholder="Search for a Celebrity or Talent"
            value={search}
            onChange={handleSearch}
          />
          <div className="mugshots-sort" role="group" aria-label="Mugshot order">
            <button type="button" aria-label="Random order" title="Random order" aria-pressed={order === 'random'} onClick={() => { setOrder('random'); setPage(1); }}>
              <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3.5-2 5-5m2-3c1.5-2.5 3-4 5-4h3m-4-4 4 4-4 4" /></svg>
            </button>
            <button type="button" aria-label="Alphabetical order" title="Alphabetical (A–Z)" aria-pressed={order === 'alphabetical'} onClick={() => { setOrder('alphabetical'); setPage(1); }}>
              <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 10 3-7 3 7M4 8h4m-5 6h6l-6 7h6M17 3v18m-4-4 4 4 4-4" /></svg>
            </button>
          </div>
          {search && (
            <p className="mugshots-results-count">
              Showing {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      <div className="mugshots-grid-section starry-bg">
        <div className="container mugshots-grid">
          {visible.map((celeb, i) => (
            <Link key={celeb.song || celeb.artist} to={`/mugshots/${celeb.song}`} className="mugshot-card">
              <div className="mugshot-photo-frame">
              <img
                src={celeb.image}
                alt={celeb.artist}
                className="mugshot-photo"
                loading="lazy"
                onError={e => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div
                className="mugshot-fallback"
                style={{ background: colors[i % colors.length], display: 'none' }}
              >
                {getInitials(celeb.artist)}
              </div>
              </div>
              <div className="mugshot-info">
                <strong>{celeb.artist}</strong>
                <span>{celeb.link}</span>
              </div>
            </Link>
          ))}
          {filtered.length === 0 && (
            <p className="no-results">No celebrities found for &ldquo;{search}&rdquo;</p>
          )}
        </div>
        {hasMore && (
          <div className="mugshots-load-more">
            <button
              className="load-more-btn"
              onClick={() => setPage(p => p + 1)}
            >
              Load More ({filtered.length - visible.length} remaining)
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
