import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import SantaRequestLedger from '../../src/components/SantaRequestLedger.jsx';

// Test-only UI fixture, not imported by the application or emitted by its build.
// No auth is bypassed: browser tests intercept API responses; real APIs stay protected.
createRoot(document.getElementById('root')).render(<MemoryRouter>
  <SantaRequestLedger email="admin@santaradio.co.uk" onSignOut={() => {}} />
</MemoryRouter>);
