import { useState, useMemo } from 'react';
import './MugShots.css';
import mugshotsData from '../data/mugshots.json';

const ITEMS_PER_PAGE = 48;

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const colors = ['#b71c1c','#1565c0','#2e7d32','#6a1b9a','#e65100','#00695c','#37474f','#c62828'];

export default function MugShots() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search.trim()) return mugshotsData;
    const q = search.toLowerCase();
    return mugshotsData.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.role.toLowerCase().includes(q)
    );
  }, [search]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const visible = filtered.slice(0, page * ITEMS_PER_PAGE);
  const hasMore = page * ITEMS_PER_PAGE < filtered.length;

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  return (
    <main>
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
            Santa Radio's celebrity mug shots feature hundreds of famous faces from TV, radio, music, comedy and
            sport, all proudly posing with the iconic Santa Radio mug.
          </p>
          <p className="mugshots-count">
            <span className="count-num">{mugshotsData.length}</span> Celebrity Mugshots and Counting...
          </p>
          <input
            type="text"
            className="mugshots-search"
            placeholder="Search for a Celebrity or Talent"
            value={search}
            onChange={handleSearch}
          />
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
            <div key={celeb.slug || celeb.name} className="mugshot-card">
              <img
                src={celeb.image}
                alt={celeb.name}
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
                {getInitials(celeb.name)}
              </div>
              <div className="mugshot-info">
                <strong>{celeb.name}</strong>
                <span>{celeb.role}</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="no-results">No celebrities found for "{search}"</p>
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
