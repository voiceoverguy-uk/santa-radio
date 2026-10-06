import { useState } from 'react';

export default function Portrait({ src, alt, className, loading = 'lazy' }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) return <div className={`${className} portrait-fallback`} role="img" aria-label={alt}>{alt.split(' ').filter(Boolean).map(word => word[0]).slice(0, 2).join('')}</div>;
  return <img src={src} alt={alt} className={className} loading={loading} onError={() => setFailed(true)} />;
}
