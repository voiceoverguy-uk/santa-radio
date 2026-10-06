import './RadioTracks.css';

export default function RadioTracks({ metadata, kind = 'current', showLabel = true }) {
  const current = kind === 'current';
  const status = current ? metadata?.currentStatus : metadata?.upcomingStatus;
  const track = metadata?.current;
  const upcoming = Array.isArray(metadata?.upcoming) ? metadata.upcoming : [];
  const hasTrack = track && (track.title || track.artist);
  const tracks = upcoming.filter(item => item && (item.title || item.artist));
  const loading = status === 'loading';
  const ready = status === 'ready';

  return (
    <div className={`radio-tracks radio-tracks-${kind}`} aria-busy={loading} aria-live={current ? 'polite' : 'off'}>
      {showLabel && <p className="radio-tracks-label">{current ? 'On air now' : 'Coming up'}</p>}
      {loading ? (
        <div role="status">
          <span className="radio-tracks-sr-only">{current ? 'Loading current song…' : 'Loading upcoming songs…'}</span>
          <span className="radio-tracks-skeleton" aria-hidden="true" />
          <span className="radio-tracks-skeleton" aria-hidden="true" />
        </div>
      ) : ready && current && hasTrack ? (
        <div>
          {track.title && <span className="radio-track-title">{track.title}</span>}
          {track.artist && <span className="radio-track-artist">{track.artist}</span>}
        </div>
      ) : ready && !current && tracks.length > 0 ? (
        <ol className="radio-tracks-list" aria-label="Upcoming songs in broadcast order">
          {tracks.slice(0, 3).map((item, index) => (
            <li key={`${index}-${item.artist}-${item.title}`}>
              {item.title && <span className="radio-track-title">{item.title}</span>}
              {item.artist && <span className="radio-track-artist">{item.artist}</span>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="radio-tracks-message">
          {current ? 'Current song details are unavailable.' : ready ? 'No upcoming songs listed yet.' : 'Upcoming song details are unavailable.'}
        </p>
      )}
    </div>
  );
}
