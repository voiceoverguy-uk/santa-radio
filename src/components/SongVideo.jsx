import ExternalMediaConsent from './ExternalMediaConsent.jsx';

export default function SongVideo({ song, className, title }) {
  if (!song.youtube) return null;

  if (song.youtubeEmbed === false) {
    return (
      <div className={className}>
        <p>This video’s owner does not allow playback on other websites.</p>
        {song.youtubeTitle && <p>Linked performance: {song.youtubeTitle} — {song.artist}.</p>}
        <a className="btn-red" href={`https://www.youtube.com/watch?v=${song.youtube}`}
          target="_blank" rel="noopener noreferrer">Watch on YouTube</a>
      </div>
    );
  }

  return (
    <div className={className}>
      <ExternalMediaConsent provider="YouTube" href={`https://www.youtube.com/watch?v=${song.youtube}`}>
      <iframe width="100%" height="315" loading="lazy"
        src={`https://www.youtube.com/embed/${song.youtube}`}
        title={title || `${song.artist} - ${song.song}`}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen />
      </ExternalMediaConsent>
    </div>
  );
}
