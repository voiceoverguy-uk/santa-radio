import { useEffect, useState } from 'react';
import { useRadio } from './radio-context.js';
import { galleryMatchesTrack, galleryPlayTime } from '../lib/artistGallerySchedule.js';
import { formatPlayTime } from '../lib/radio-schedule.js';
import './SongPlaybackStatus.css';

export default function SongPlaybackStatus({ song }) {
  const { metadata, upcoming = [] } = useRadio();
  const [now, setNow] = useState(Date.now);
  const image = { songId: song?.id, artist: song?.artist, title: song?.song };
  const current = metadata?.currentStatus === 'ready' && galleryMatchesTrack(image, metadata.current);
  const playingAt = galleryPlayTime(image, upcoming, now);
  useEffect(() => {
    if (playingAt === null || current) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [playingAt, current]);
  if (!current && playingAt === null) return null;
  return <span className="song-playback-status" role="status">
    {current ? 'Now playing' : `Playing at ${formatPlayTime(playingAt)}`}
  </span>;
}
