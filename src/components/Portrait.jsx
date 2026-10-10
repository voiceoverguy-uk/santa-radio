import { useState } from 'react';
import { mugSrcSet } from '../seo/mugImages.js';

export default function Portrait({ src, alt, className, loading = 'eager', srcSet, sizes }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) return <div className={`${className} portrait-fallback`} role="img" aria-label={alt}>{alt.split(' ').filter(Boolean).map(word => word[0]).slice(0, 2).join('')}</div>;
  return <img src={src} alt={alt} className={className} width="1000" height="1200" loading={loading} srcSet={srcSet || (src.startsWith('/mugshot-images/') ? mugSrcSet(src) : undefined)} sizes={sizes || '(max-width: 600px) 90vw, 420px'} decoding="async" onError={() => setFailed(true)} />;
}
