import { useState } from 'react';
import './Music.css';

const SONGS = [
  { artist: 'Cruz Beckham', song: 'If Every Day was Christmas' },
  { artist: 'Ava Max', song: 'Christmas Without You' },
  { artist: 'Pat Benatar', song: 'Please Come Home For Christmas' },
  { artist: 'Leona Lewis', song: "Kiss Me It's Christmas" },
  { artist: 'Dion', song: 'Christmas (Baby Please Come Home)' },
  { artist: 'The Beach Boys', song: "I'll Be Home For Christmas" },
  { artist: 'Kylie Minogue', song: 'Cried Out Christmas' },
  { artist: 'Jason Mraz', song: 'Winter Wonderland' },
  { artist: 'Snap!', song: 'Mary Had A Little Boy' },
  { artist: 'Mariah Carey', song: 'All I Want For Christmas Is You' },
  { artist: 'Cher', song: 'DJ Play a Christmas Song' },
  { artist: 'Bing Crosby', song: 'The Christmas Song' },
  { artist: 'Jon Bon Jovi', song: 'Please Come Home For Christmas' },
  { artist: 'Gladys Knight & The Pips', song: "It's Christmas Everyday" },
  { artist: 'Matt Monro', song: "Mary's Boy Child" },
  { artist: 'Michael Buble', song: 'The Christmas Sweater' },
  { artist: 'Sam Ryder', song: "You're Christmas to me" },
  { artist: 'Al Green', song: 'What Christmas Means To Me' },
  { artist: 'Paul McCartney', song: 'Wonderful Christmastime' },
  { artist: 'Chuck Berry', song: 'Run Rudolph Run' },
  { artist: 'John Legend', song: 'Bring Me Love' },
  { artist: 'Bing Crosby', song: 'God Rest Ye Merry Gentlemen' },
  { artist: 'Michael Buble', song: 'Winter Wonderland' },
  { artist: 'Kylie Minogue', song: 'White December' },
];

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function ArtistAvatar({ artist }) {
  const colors = ['#b71c1c','#1565c0','#2e7d32','#6a1b9a','#e65100','#00695c','#37474f'];
  const color = colors[artist.charCodeAt(0) % colors.length];
  return (
    <div className="artist-avatar" style={{ background: color }}>
      <span>{getInitials(artist)}</span>
    </div>
  );
}

export default function Music() {
  const [search, setSearch] = useState('');

  const filtered = SONGS.filter(s =>
    s.artist.toLowerCase().includes(search.toLowerCase()) ||
    s.song.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main>
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
          <button className="btn-red suggest-btn">Suggest a song</button>
          <input
            type="text"
            className="music-search"
            placeholder="Search for a song or artist"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="music-icons">
            <span title="Shuffle">🔀</span>
            <span title="Artists">👥</span>
            <span title="Songs">🎵</span>
          </div>
        </div>
      </div>

      <div className="music-grid-section starry-bg">
        <div className="container music-grid">
          {filtered.map((s, i) => (
            <div key={i} className="song-card">
              <ArtistAvatar artist={s.artist} />
              <div className="song-info">
                <strong>{s.artist}</strong>
                <span>{s.song}</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="no-results">No songs found for "{search}"</p>
          )}
        </div>
      </div>
    </main>
  );
}
