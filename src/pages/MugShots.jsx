import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import './MugShots.css';
import './MugshotPhoto.css';
import mugshotsData from '../data/mugshots.ts';
import PageSeo from '../seo/PageSeo.jsx';
import { collectionMetadata, mugImageAlt } from '../seo/catalogue.js';
import { mugSrcSet } from '../seo/mugImages.js';
import { mugshotShutterEvents } from '../audio/mugshotShutter.js';

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
    // Preserve the owner's original YES selections as the first random group.
    return [
      ...shuffled.filter(celeb => celeb.homepage === true),
      ...shuffled.filter(celeb => celeb.homepage !== true),
    ];
  });
  const alphabetical = useMemo(() => [...mugshotsData].sort((a, b) =>
    Number(b.homepage === true) - Number(a.homepage === true) ||
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
    <main className="mugshots-collection-page">
      <PageSeo metadata={collectionMetadata('mugs')} />
      <div className="mugshots-page-hero starry-bg">
        <div className="mugshots-hero-content">
          <p className="mugshots-eyebrow">THE SANTA RADIO HALL OF FAME</p>
          <h1 className="mugshots-page-title">Celebrity Mugshots</h1>
          <p className="mugshots-page-sub">Famous faces. One festive mug.</p>
          <p className="mugshots-page-desc">
            Ecurb the Elf has been out meeting famous faces with our Santa Radio mug. Explore the collection from TV,
            radio, music, comedy and sport.
          </p>
          <p className="mugshots-count">
            <span className="count-num">{mugshotsData.length}</span> mugshots and counting
          </p>
          <div className="mugshots-controls">
            <label className="mugshots-search-label" htmlFor="mugshots-search">Find a famous face</label>
            <div className="mugshots-search-wrap">
              <svg className="mugshots-search-icon" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg>
            <input
              id="mugshots-search"
              type="text"
              aria-label="Find a famous face"
              className="mugshots-search"
              placeholder="Search by name or talent…"
              value={search}
              onChange={handleSearch}
            />
            </div>
            <div className="mugshots-sort" role="group" aria-label="Mugshot order">
              <span className="mugshots-sort-caption">Sort</span>
              <button type="button" aria-label="Shuffle" title="Shuffle" aria-pressed={order === 'random'} onClick={() => { setOrder('random'); setPage(1); }}>
                <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3.5-2 5-5m2-3c1.5-2.5 3-4 5-4h3m-4-4 4 4-4 4" /></svg>
                <span className="mugshots-sort-button-label">Shuffle</span>
              </button>
              <button type="button" aria-label="A–Z" title="A–Z" aria-pressed={order === 'alphabetical'} onClick={() => { setOrder('alphabetical'); setPage(1); }}>
                <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 10 3-7 3 7M4 8h4m-5 6h6l-6 7h6M17 3v18m-4-4 4 4 4-4" /></svg>
                <span className="mugshots-sort-button-label">A–Z</span>
              </button>
            </div>
          </div>
          {search && (
            <p className="mugshots-results-count">
              Showing {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      <div className="mugshots-grid-section starry-bg">
        <h2 className="mugshots-browse-heading">Browse the collection</h2>
        <div className="container mugshots-grid">
          {visible.map((celeb, i) => (
            <Link key={celeb.song || celeb.artist} to={`/mugshots/${celeb.song}`} className="mugshot-card" {...mugshotShutterEvents}>
              <div className="mugshot-photo-frame">
              <img
                src={celeb.image}
                srcSet={mugSrcSet(celeb.image)}
                sizes="(max-width: 600px) 44vw, (max-width: 1000px) 30vw, 220px"
                alt={mugImageAlt(celeb)}
                width="1000" height="1200"
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
      <section className="seo-directory" aria-labelledby="mug-directory-heading">
        <h2 id="mug-directory-heading">All celebrity mug photographs — A–Z</h2>
        <p>Friendly photographs with Santa Radio mugs, not criminal mugshots. Every retained profile is linked below; no Load More click is needed.</p>
        <ul>{alphabetical.map(celeb => <li key={celeb.song}><Link to={`/mugshots/${celeb.song}`}>{celeb.artist}</Link></li>)}</ul>
      </section>
    </main>
  );
}
