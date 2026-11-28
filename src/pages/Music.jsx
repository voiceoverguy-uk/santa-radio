import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SongArtwork from '../components/SongArtwork.jsx';
import ArtistGallery from '../components/ArtistGallery.jsx';
import { managedArtistGallery } from '../data/managedArtistGallery.js';
import { useCatalogueArtwork } from '../hooks/useCatalogueArtwork.js';
import './Music.css';
import { songs as songsData, songsByArtistAZ, collectionMetadata } from '../seo/catalogue.js';
import PageSeo from '../seo/PageSeo.jsx';
import { randomSongOrder } from '../data/randomSongOrder.js';

import { useRadio } from '../components/radio-context.js';
import { matchLiveSong } from '../data/matchLiveSong.js';
import { formatPlayTime } from '../lib/radio-schedule.js';
import { upcomingCountdownSeconds } from '../lib/upcomingTrackGlow.js';

const shuffleSongs = () => randomSongOrder(songsData);

function ArtistAvatar({ song }) {
  return (
    <SongArtwork song={song} className="artist-avatar-img" width="120" height="120" loading="lazy" />
  );
}

function UpcomingSongCard({ track, song, index }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!Number.isFinite(track.estimatedAt)) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [track.estimatedAt]);
  const seconds = index === 0 ? upcomingCountdownSeconds(track.estimatedAt, now) : null;
  const aboutToPlay = seconds !== null;
  const countdown = aboutToPlay ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : null;
  const Card = song ? Link : 'div';
  return <Card {...(song ? { to: `/christmas-artist/${song.id}-${song.link}` } : {})}
    className={`song-card song-card-upcoming${aboutToPlay ? ' song-card-upcoming--soon' : ''}`}>
    <ArtistAvatar song={song || { artist: track.artist || '', song: track.title || '' }} />
    <div className="song-info">
      <strong>{song?.artist || track.artist}</strong>
      <span>{song?.song || track.title}</span>
      <span className="song-coming-up">{['Playing next', 'Warming up in the wings', 'Next stop: Christmas!', 'Worth the wait…'][index] || 'Coming up'}</span>
      {countdown && <span className="song-coming-up song-coming-up-countdown" role="timer" aria-label={`Next song in ${seconds} seconds`}>Playing in {countdown}</span>}
      {Number.isFinite(track.estimatedAt) && <span className="song-coming-up">{index === 1 ? 'Around' : 'Expected at'} {formatPlayTime(track.estimatedAt)}</span>}
    </div>
  </Card>;
}

export default function Music() {
  const artwork = useCatalogueArtwork();
  const galleryImages = useMemo(() => managedArtistGallery(artwork), [artwork]);
  const { upcoming: scheduled = [] } = useRadio();
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState('random');
  const [randomSongs, setRandomSongs] = useState(shuffleSongs);

  const filtered = (order === 'random' ? randomSongs : songsByArtistAZ).filter(s =>
    s.artist.toLowerCase().includes(search.toLowerCase()) ||
    s.song.toLowerCase().includes(search.toLowerCase())
  );

  const upcoming = order === 'random' && !search.trim()
    ? scheduled.slice(0, 4)
      .map(track => ({ track, song: matchLiveSong(track, songsData).song }))
    : [];
  const upcomingIds = new Set(upcoming.map(item => item.song?.id));
  const catalogueSongs = filtered.filter(song => !upcomingIds.has(song.id));

  return (
    <main className="music-page">
      <PageSeo metadata={collectionMetadata('music')} />
      <div className="music-hero starry-bg">
        <div className="music-hero-content">
          <h1 className="music-logo-heading"><img className="music-page-logo" src="/images/santa-radio-music-logo-v1.webp" alt="Santa Radio — The Music" width="1680" height="945" /></h1>
          <p className="music-sub-desc">Christmas songs, lyrics & artists</p>
          <div className="music-browse-controls">
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
          <div className="music-order-controls" role="group" aria-label="Music browsing">
            <button type="button" aria-label="Random" aria-pressed={order === 'random'} onClick={() => { setRandomSongs(shuffleSongs()); setOrder('random'); }} title="Random order — shuffle again">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 5-5m2-2c2-3 3-5 5-5h3m-4-4 4 4-4 4" /></svg>
            </button>
            <button type="button" aria-label="Artist A–Z" aria-pressed={order === 'az'} onClick={() => setOrder('az')} title="Artist A–Z">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 10 3-7 3 7M4 8h4m-5 6h6l-6 7h6M17 3v18m-4-4 4 4 4-4" /></svg>
            </button>
            <ArtistGallery images={galleryImages} />
          </div>
          </div>
        </div>
      </div>

      <div className="music-grid-section starry-bg">
        {upcoming.length > 0 && <section className="container music-upcoming" aria-labelledby="music-upcoming-heading">
          <h2 id="music-upcoming-heading">Coming up on Santa Radio</h2>
          <div className="music-grid">
            {upcoming.map(({ track, song }, index) => <UpcomingSongCard
              key={`upcoming-${index}-${track.artist}-${track.title}`}
              track={track} song={song} index={index} />)}
          </div>
        </section>}
        <div className="container music-grid">
          {catalogueSongs.map((s) => (
            <Link key={`${s.id}-${s.link}`} to={`/christmas-artist/${s.id}-${s.link}`} className="song-card">
              <ArtistAvatar song={s} />
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
