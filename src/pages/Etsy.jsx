import { useNavigate } from 'react-router-dom';
import { WorkshopPasswordForm } from '../components/WorkshopPasswordForm.jsx';
import PageSeo from '../seo/PageSeo.jsx';
import { pageMetadata } from '../seo/catalogue.js';
import { STUDIO_PATH } from '../lib/studioRoute.js';
import './Etsy.css';

export default function Etsy() {
  const navigate = useNavigate();
  return <>
    <PageSeo metadata={pageMetadata({
      path: '/etsy',
      title: 'Your Etsy Santa Message | Santa Radio',
      description: 'Enter the code supplied with your Etsy order to open Santa’s message maker.',
      noindex: true,
    })} />
    <main className="workshop-gate etsy-page">
      <section className="workshop-gate-card" aria-labelledby="etsy-title">
        <p className="etsy-brand">Santa Radio</p>
        <h1 id="etsy-title">Your Santa message</h1>
        <p>Enter the code sent with your Etsy order to open the message maker.</p>
        <WorkshopPasswordForm onAuthorized={() => navigate(STUDIO_PATH)} />
      </section>
    </main>
  </>;
}
