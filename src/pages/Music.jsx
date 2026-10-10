import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { artistArtwork, fallbackArtwork } from '../data/artistArtwork.js';
import './Music.css';
import songsData from '../data/songs.json';
import { randomSongOrder } from '../data/randomSongOrder.js';

const shuffleSongs = () => randomSongOrder(songsData);

const alphabeticalSongs = [...songsData].sort((a, b) =>
  a.artist.localeCompare(b.artist, 'en-GB', { sensitivity: 'base', numeric: true }) ||
  a.song.localeCompare(b.song, 'en-GB', { sensitivity: 'base', numeric: true })
);

function ArtistAvatar({ artist }) {
  const src = artistArtwork(artist);
  return (
    <img key={src} src={src} alt={src === fallbackArtwork ? 'Santa with music notes — temporary artwork' : `${artist} illustrated portrait`}
      className="artist-avatar-img" width="120" height="120" loading="lazy"
      onError={event => {
        if (event.currentTarget.getAttribute('src') !== fallbackArtwork) {
          event.currentTarget.src = fallbackArtwork;
          event.currentTarget.alt = 'Santa with music notes — temporary artwork';
        }
      }} />
  );
}

export default function Music() {
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState('random');
  const [randomSongs, setRandomSongs] = useState(shuffleSongs);

  const filtered = (order === 'random' ? randomSongs : alphabeticalSongs).filter(s =>
    s.artist.toLowerCase().includes(search.toLowerCase()) ||
    s.song.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main>
      <Helmet>
        <title>Christmas Song Lyrics & Artists {'\u2013'} Santa Radio</title>
        <meta name="description" content="Discover the biggest online collection of Christmas songs with full lyrics, artists, custom artwork and festive music for every track on Santa Radio." />
        <meta property="og:title" content="Christmas Song Lyrics & Artists – Santa Radio" />
        <meta property="og:description" content="Discover the biggest online collection of Christmas songs with full lyrics, artists, custom artwork and festive music." />
        <meta property="og:url" content="https://www.santaradio.co.uk/christmas-music" />
        <meta name="twitter:card" content="summary" />
        <link rel="canonical" href="https://www.santaradio.co.uk/christmas-music" />
      </Helmet>
      <div className="music-hero starry-bg">
        <div className="music-hero-content">
          <h1 className="music-hero-title"><img className="brand-logo brand-logo-hero" src="/images/santa-radio-logo.png" alt="Santa Radio" width="827" height="190" /></h1>
          <h2 className="music-sub-title">Christmas Song Lyrics &amp; Artists</h2>
          <p className="music-sub-desc">Browse Hundreds of Christmas Songs</p>
          <p className="music-description">
            Discover the biggest online collection of Christmas songs — with full lyrics, artists,
            custom artwork and festive music for every track. Search instantly through hundreds of
            Christmas classics, pop hits and hidden gems. New songs and artist images added regularly.
          </p>
          <Link to="/submit-a-song" className="btn-red suggest-btn">Suggest a song</Link>
          <div className="music-search-wrap">
          <svg className="music-search-symbol" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></svg>
          <input
            type="text"
            aria-label="Search for a song or artist"
            className="music-search"
            placeholder="Search for a song or artist"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          </div>
          <div className="music-order-controls" role="group" aria-label="Song order">
            <button type="button" aria-label="Random" aria-pressed={order === 'random'} onClick={() => { setRandomSongs(shuffleSongs()); setOrder('random'); }} title="Random order — shuffle again">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 5-5m2-2c2-3 3-5 5-5h3m-4-4 4 4-4 4" /></svg>
            </button>
            <button type="button" aria-label="Artist A–Z" aria-pressed={order === 'az'} onClick={() => setOrder('az')} title="Artist A–Z">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 10 3-7 3 7M4 8h4m-5 6h6l-6 7h6M17 3v18m-4-4 4 4 4-4" /></svg>
            </button>
          </div>
          <p className="music-results-count" role="status">{filtered.length} songs to explore · {order === 'random' ? 'Random order' : 'Artist A–Z'}</p>
        </div>
      </div>

      <div className="music-grid-section starry-bg">
        <div className="container music-grid">
          {filtered.map((s) => (
            <Link key={`${s.id}-${s.link}`} to={`/christmas-artist/${s.id}-${s.link}`} className="song-card">
              <ArtistAvatar artist={s.artist} />
              <div className="song-info">
                <strong>{s.artist}</strong>
                <span>{s.song}</span>
              </div>
            </Link>
          ))}
          {filtered.length === 0 && (
            <p className="no-results">No songs found for &ldquo;{search}&rdquo;</p>
          )}
        </div>
      </div>
    </main>
  );
}
