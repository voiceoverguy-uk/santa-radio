import { Helmet } from 'react-helmet-async';
import './SubmitASong.css';

export default function SubmitASong() {
  return (
    <main>
      <Helmet>
        <title>How do I submit a song to Santa Radio?</title>
        <meta name="description" content="Find out how to submit your Christmas song to Santa Radio for airplay consideration." />
      </Helmet>
      <div className="submit-hero starry-bg">
        <div className="submit-hero-content">
          <h1 className="submit-title gold-text">Submit a song to Santa Radio</h1>
          <div className="submit-body">
            <p>
              If you would like to submit a song for airplay consideration on Santa Radio, please email us at{' '}
              <a href="mailto:songs@santaradio.co.uk">songs@santaradio.co.uk</a> with the following information:
            </p>
            <ul>
              <li>Artist name</li>
              <li>Song title</li>
              <li>A link to the song (YouTube, SoundCloud, Spotify etc.)</li>
              <li>A short bio or description</li>
            </ul>
            <p>
              We listen to every submission and if your song is selected, we will add it to our playlist and let you know!
            </p>
            <p>
              Please note: We receive a large number of submissions and unfortunately cannot respond to every one individually.
              If your song is selected for airplay, we will contact you directly.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
