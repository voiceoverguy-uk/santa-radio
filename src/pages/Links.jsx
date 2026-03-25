import { Helmet } from 'react-helmet-async';
import './Links.css';

export default function Links() {
  return (
    <main>
      <Helmet>
        <title>Friends of Santa Radio</title>
        <meta name="description" content="Friends of Santa Radio - Check out our favourite links and partners who help spread Christmas cheer all year round." />
      </Helmet>
      <div className="links-hero starry-bg">
        <div className="links-hero-content">
          <h1 className="links-title gold-text">Friends of Santa Radio</h1>
          <div className="links-body">
            <p>
              Check out our favourite links and partners who help spread Christmas cheer all year round.
            </p>
            <p>
              If you would like to be added to this page, please get in touch at{' '}
              <a href="mailto:santa@santaradio.co.uk">santa@santaradio.co.uk</a>.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
