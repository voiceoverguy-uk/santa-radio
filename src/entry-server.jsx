import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.jsx';
import './index.css';
import './seo/seo.css';
import { resolvePublicRequest } from './seo/routes.js';

export function render(url) {
  const result = resolvePublicRequest(url);
  const context = {};
  const markup = renderToString(<HelmetProvider context={context}><App Router={StaticRouter} routerProps={{ location: result.status === 404 ? '/404' : url }} /></HelmetProvider>);
  const helmet = context.helmet;
  return { ...result, markup, head: ['title', 'meta', 'link', 'script'].map(key => helmet[key].toString()).join('\n') };
}
