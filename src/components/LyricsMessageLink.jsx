import { Link } from 'react-router-dom';
import './LyricsMessageLink.css';

export default function LyricsMessageLink() {
  return (
    <div className="lyrics-message-link">
      <Link to="/free-santa-message" className="btn-red">FREE Santa Message</Link>
    </div>
  );
}
