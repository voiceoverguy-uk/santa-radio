import { Helmet } from 'react-helmet-async';
import './SantaStories.css';

export default function SantaStories() {
  return (
    <main>
      <Helmet>
        <title>Santa Text Secret Code Words</title>
        <meta name="description" content="Santa Text Secret Code Words - Discover the secret code words from Santa's text messages on Santa Radio." />
      </Helmet>
      <div className="stories-hero starry-bg">
        <div className="stories-hero-content">
          <h1 className="stories-title gold-text">Santa Text Secret Code Words</h1>
          <div className="stories-body">
            <p>
              Discover the secret code words from Santa's text messages on Santa Radio. Listen carefully to Santa Radio for
              the secret code words and text them in for your chance to win fantastic prizes!
            </p>
            <p>
              Keep listening to Santa Radio for more details on how to enter and win!
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
