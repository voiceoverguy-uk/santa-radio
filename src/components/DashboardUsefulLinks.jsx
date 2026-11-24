import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { ORIGIN } from '../seo/catalogue.js';
import { messageMakerOffers, messageOfferPath } from '../lib/messageMakerOffers.js';
import './DashboardUsefulLinks.css';


export default function DashboardUsefulLinks() {
  const [copied, setCopied] = useState('');
  const [notice, setNotice] = useState('');

  async function copyLink(label, url) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setNotice(`Copied the link for ${label}.`);
    } catch {
      setCopied('');
      setNotice('Select the URL and copy it manually.');
    }
  }

  return (
    <section className="dashboard-links" aria-labelledby="dashboard-links-title">
      <h2 id="dashboard-links-title">Useful links</h2>
      <ul>
        {messageMakerOffers.map(offer => {
          const { id, label = offer.title } = offer;
          const url = `${ORIGIN}${messageOfferPath(offer)}`;
          const Icon = copied === url ? Check : Copy;
          return (
            <li key={id}>
              <div>
                <strong>{label}</strong>
                <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
              </div>
              <button type="button" onClick={() => copyLink(label, url)}
                aria-label={`Copy link for ${label}`} title={`Copy link for ${label}`}>
                <Icon size={17} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      <p role="status">{notice}</p>
    </section>
  );
}
