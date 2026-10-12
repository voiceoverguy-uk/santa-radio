import { Helmet } from 'react-helmet-async';
export default function PageSeo({ metadata: m }) {
  return <Helmet>
    <title>{m.title}</title>
    <meta name="description" content={m.description} />
    <meta name="robots" content={m.noindex ? 'noindex, follow' : 'index, follow'} />
    {!m.noindex && <link rel="canonical" href={m.url} />}
    <meta property="og:title" content={m.title} /><meta property="og:description" content={m.description} />
    <meta property="og:url" content={m.url} /><meta property="og:type" content="website" />
    <meta property="og:site_name" content="Santa Radio" /><meta property="og:locale" content="en_GB" />
    <meta property="og:image" content={m.image} /><meta property="og:image:alt" content={m.imageAlt} />
    {m.imageWidth && <meta property="og:image:width" content={m.imageWidth} />}
    {m.imageHeight && <meta property="og:image:height" content={m.imageHeight} />}
    {m.imageType && <meta property="og:image:type" content={m.imageType} />}
    <meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content={m.title} />
    <meta name="twitter:description" content={m.description} /><meta name="twitter:image" content={m.image} />
    <meta name="twitter:image:alt" content={m.imageAlt} />
    {!m.noindex && <script type="application/ld+json">{JSON.stringify({ '@context': 'https://schema.org', '@graph': m.graph }).replace(/</g, '\\u003c')}</script>}
  </Helmet>;
}
