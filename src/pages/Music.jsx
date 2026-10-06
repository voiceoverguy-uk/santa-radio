import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Portrait from '../components/Portrait.jsx';
import './Music.css';
import songsData from '../data/songs.json';

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function ArtistAvatar({ artist, image }) {
  if (image) {
    return (
      <Portrait src={image} alt={artist} className="artist-avatar-img" />
    );
  }
  const colors = ['#1B4332','#254c3a','#365642','#7c242b'];
  const color = colors[artist.charCodeAt(0) % colors.length];
  return (
    <div className="artist-avatar" style={{ background: color }}>
      <span>{getInitials(artist)}</span>
    </div>
  );
}

export default function Music() {
  const [search, setSearch] = useState('');

  const filtered = songsData.filter(s =>
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
          <h1 className="music-hero-title gold-text">Santa Radio</h1>
          <h2 className="music-sub-title">Christmas Song Lyrics &amp; Artists</h2>
          <p className="music-sub-desc">Browse Hundreds of Christmas Songs</p>
          <p className="music-description">
            Discover the biggest online collection of Christmas songs — with full lyrics, artists,
            custom artwork and festive music for every track. Search instantly through hundreds of
            Christmas classics, pop hits and hidden gems. New songs and artist images added regularly.
          </p>
          <Link to="/submit-a-song" className="btn-red suggest-btn">Suggest a song</Link>
          <input
            type="text"
            aria-label="Search for a song or artist"
            className="music-search"
            placeholder="Search for a song or artist"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <p className="music-results-count" role="status">{filtered.length} songs to explore</p>
        </div>
      </div>

      <div className="music-grid-section starry-bg">
        <div className="container music-grid">
          {filtered.map((s) => (
            <Link key={`${s.id}-${s.link}`} to={`/christmas-artist/${s.id}-${s.link}`} className="song-card">
              <ArtistAvatar artist={s.artist} image={s.image} />
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
