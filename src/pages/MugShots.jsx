import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './MugShots.css';
import './MugshotPhoto.css';
import mugshotsData from '../data/mugshots.ts';
import PageSeo from '../seo/PageSeo.jsx';
import { collectionMetadata, mugImageAlt } from '../seo/catalogue.js';
import { mugSrcSet } from '../seo/mugImages.js';
import { matchesMugshot, mugshotSuggestions } from '../data/mugshot-search.js';

const ITEMS_PER_PAGE = 100;

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const colors = ['#1B4332','#254c3a','#365642','#7c242b'];

export default function MugShots() {
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const suggestions = useMemo(() => mugshotSuggestions(mugshotsData, search), [search]);
  const menuOpen = suggestionsOpen && Boolean(search.trim());
  const activeOption = menuOpen ? suggestions[activeIndex] : null;
  useEffect(() => {
    if (activeOption) {
      listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeOption]);
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
    return ordered.filter(c => matchesMugshot(c, search, selection));
  }, [search, selection, order, randomOrder, alphabetical]);

  const visible = filtered.slice(0, page * ITEMS_PER_PAGE);
  const hasMore = page * ITEMS_PER_PAGE < filtered.length;

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setSelection(null);
    setSuggestionsOpen(true);
    setActiveIndex(-1);
    setPage(1);
  };
  const selectSuggestion = suggestion => {
    setSearch(suggestion.label);
    setSelection(suggestion);
    setSuggestionsOpen(false);
    setActiveIndex(-1);
    setPage(1);
    inputRef.current?.focus();
  };
  const handleSearchKey = event => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      setSuggestionsOpen(false);
      setActiveIndex(-1);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!search.trim() || !suggestions.length) return;
      event.preventDefault();
      setSuggestionsOpen(true);
      setActiveIndex(index => !menuOpen || index < 0 ?
        (event.key === 'ArrowDown' ? 0 : suggestions.length - 1) :
        (index + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' && activeOption) {
      event.preventDefault();
      selectSuggestion(activeOption);
    } else if (event.key === 'Tab') {
      setSuggestionsOpen(false);
      setActiveIndex(-1);
    }
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
            radio, music, comedy and sport. No A.I. here!
          </p>
          <p className="mugshots-count">
            <span className="count-num">{mugshotsData.length}</span> mugshots and counting
          </p>
          <div className="mugshots-controls">
            <label className="mugshots-search-label" htmlFor="mugshots-search">Find a famous face</label>
            <div className="mugshots-search-wrap" onBlur={event => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setSuggestionsOpen(false);
                setActiveIndex(-1);
              }
            }}>
              <svg className="mugshots-search-icon" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg>
            <input
              id="mugshots-search"
              ref={inputRef}
              type="text"
              role="combobox"
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? 'mugshots-suggestions' : undefined}
              aria-activedescendant={activeOption ? `mugshots-${activeOption.id}` : undefined}
              aria-describedby="mugshots-search-help mugshots-result-status"
              aria-label="Find a famous face"
              className="mugshots-search"
              placeholder="Search by name or talent…"
              value={search}
              onChange={handleSearch}
              onFocus={() => { if (!selection) setSuggestionsOpen(true); }}
              onKeyDown={handleSearchKey}
            />
              {search && <button type="button" className="mugshots-search-clear" aria-label="Clear search"
                onClick={() => {
                  setSearch(''); setSelection(null); setActiveIndex(-1); setSuggestionsOpen(false); setPage(1);
                  inputRef.current?.focus();
                }}>×</button>}
              <span id="mugshots-search-help" className="mugshots-search-sr">Results filter as you type. Use up and down arrows to explore suggestions, Enter to select and Escape to dismiss.</span>
              {menuOpen && <div className="mugshots-suggestions-panel">
                <ul id="mugshots-suggestions" role="listbox" aria-label="Name and talent suggestions" ref={listRef}>
                  {suggestions.map((suggestion, index) => <li key={suggestion.id}
                    id={`mugshots-${suggestion.id}`} role="option" aria-selected={index === activeIndex}
                    onPointerDown={event => event.preventDefault()}
                    onClick={() => selectSuggestion(suggestion)}
                  >
                    <span className="mugshots-suggestion-kind">{suggestion.type === 'name' ? 'Name' : 'Talent'}</span>
                    <span>{suggestion.label}</span>
                  </li>)}
                </ul>
                {!suggestions.length && <p className="mugshots-suggestions-empty">No matching names or talents.</p>}
              </div>}
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
          <p id="mugshots-result-status" role="status" aria-live="polite" aria-atomic="true"
            className={search.trim() ? 'mugshots-results-count' : 'mugshots-search-sr'}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}.
            {menuOpen && ` ${suggestions.length} suggestion${suggestions.length !== 1 ? 's' : ''} available.`}
          </p>
        </div>
      </div>

      <div className="mugshots-grid-section starry-bg">
        <h2 className="mugshots-browse-heading">Browse the collection</h2>
        <div className="container mugshots-grid">
          {visible.map((celeb, i) => (
            <Link key={celeb.song || celeb.artist} to={`/mugshots/${celeb.song}`} className="mugshot-card">
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
    </main>
  );
}
