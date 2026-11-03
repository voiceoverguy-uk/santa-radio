import React from 'react';
import { createRoot } from 'react-dom/client';
import './host.css';
import './fonts.css';
import SantaTrackerPage from './tracker/app/santa-tracker/page';
import SantaTrackerClient from './tracker/components/SantaTrackerClient';

// Query form works with bundled index.html; path form supports browser previews.
const preview = new URLSearchParams(location.search).get('preview') === '1'
  || location.pathname.endsWith('/santa-tracker/preview');
createRoot(document.getElementById('root')!).render(
  preview
    ? <main className="santa-tracker"><SantaTrackerClient showPreview /></main>
    : <SantaTrackerPage />
);
