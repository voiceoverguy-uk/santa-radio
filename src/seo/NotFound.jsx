import { Link } from 'react-router-dom';
import PageSeo from './PageSeo.jsx';
import { pageMetadata } from './catalogue.js';
export default function NotFound() {
  return <main className="container" style={{ padding: '8rem 1rem' }}>
    <PageSeo metadata={pageMetadata({ path: '/404', title: 'Page Not Found | Santa Radio', description: 'This page could not be found. Explore Santa Radio’s music, mug photographs and Santa Tracker.', noindex: true })} />
    <h1>Page not found</h1><p>We couldn’t find that page.</p>
    <Link to="/christmas-music">Browse Christmas music</Link>{' · '}<Link to="/mugshots/all">Explore Mug Shots</Link>{' · '}<Link to="/santa-tracker">Track Santa</Link>
  </main>;
}
