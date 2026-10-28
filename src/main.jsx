import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.jsx';
import './index.css';
import './seo/seo.css';
import { installTrackerPrivacyGuard } from './privacy/trackerPrivacy.js';
import { revokeAnalytics } from './privacy/googleAnalytics.js';
import { revokeMarketing } from './privacy/marketingConsent.js';

installTrackerPrivacyGuard(() => {
  revokeAnalytics();
  revokeMarketing();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>
);
