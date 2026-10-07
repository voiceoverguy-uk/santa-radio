import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import StructuredData from "@/components/StructuredData";
import SantaTrackerClient from "@/components/SantaTrackerClient";
import { getTrackerMetadata, TRACKER_ORIGIN, TRACKER_URL } from "@/lib/trackerBrand";
import "../../tracker.css";

export const generateMetadata = getTrackerMetadata;

const webPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${TRACKER_URL}#webpage`,
  inLanguage: "en-GB",
  name: "Santa Tracker | Track Santa's Journey — Santa Radio",
  description: getTrackerMetadata().description,
  url: TRACKER_URL,
  isPartOf: { "@id": `${TRACKER_ORIGIN}/#website` },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Santa Radio", item: TRACKER_ORIGIN },
    { "@type": "ListItem", position: 2, name: "Santa Tracker", item: TRACKER_URL },
  ],
};

export default function SantaTrackerPage() {
  const metadata = generateMetadata();
  return (
    <main className="santa-tracker">
      <Helmet>
        <title>{metadata.title.absolute}</title>
        <meta name="description" content={metadata.description} />
        <link rel="canonical" href={TRACKER_URL} />
        <meta property="og:title" content={metadata.openGraph.title} />
        <meta property="og:description" content={metadata.description} />
        <meta property="og:url" content={TRACKER_URL} />
        <meta property="og:site_name" content="Santa Radio" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_GB" />
        <meta property="og:image" content={metadata.openGraph.images[0].url} />
        <meta property="og:image:width" content="827" />
        <meta property="og:image:height" content="190" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@wearesantaradio" />
        <meta name="twitter:creator" content="@voiceoverman" />
        <meta name="twitter:title" content={metadata.twitter.title} />
        <meta name="twitter:description" content={metadata.description} />
        <meta name="twitter:image" content={metadata.twitter.images[0]} />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600&display=swap" />
      </Helmet>
      <StructuredData data={webPageSchema} />
      <StructuredData data={breadcrumbSchema} />
      <SantaTrackerClient
        introduction={
          <>
            <nav aria-label="Breadcrumb" className="tracker-breadcrumb mb-4 text-xs text-gray-400">
              <Link to="/">Santa Radio</Link> <span aria-hidden="true">/</span> Santa Tracker
            </nav>
            <h1 className="tracker-heading text-3xl sm:text-4xl lg:text-5xl tracking-tight">
              Track Santa&apos;s Journey
              <br />
              <span className="tracker-heading-accent">Around the World</span>
            </h1>
            <p className="tracker-copy mt-4 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
              Follow Santa&apos;s estimated Christmas Eve journey around the world.
              Count down to his departure, follow his progress on the world map,
              and explore the estimated schedule for the big night.
            </p>
            <p className="tracker-copy mt-2 text-xs">Listen to Santa Radio while you follow the festive fun.</p>
          </>
        }
      />
    </main>
  );
}
