// Owner-approved preferred public address; do not force preview/API host redirects.
export const TRACKER_ORIGIN = 'https://www.santaradio.co.uk';
export const TRACKER_URL = `${TRACKER_ORIGIN}/santa-tracker`;
export const TRACKER_DISPLAY_URL = 'www.santaradio.co.uk/santa-tracker';
export const TRACKER_IMAGE = `${TRACKER_ORIGIN}/images/santa-tracker-share-v2.jpg`;
export const TRACKER_IMAGE_ALT = 'Santa Radio — Santa Tracker. Track Santa. The real Santa Radio Tracker map screen against the North Pole scene.';
export const SANTA_VOICE_URL = 'https://www.santaguy.co.uk/hire-santa-voice';

export const TRACKER_TITLE = 'Santa Tracker | Track Santa All Year Round | Santa Radio';
export const TRACKER_DESCRIPTION = 'Where is Santa now? Track Santa all year with our free interactive map, holiday adventures and Christmas Eve countdown. Enjoy Christmas music as you explore.';

export function getTrackerMetadata(now = new Date()) {
  const inJuly = now.getUTCMonth() === 6;
  const title = inJuly
    ? 'Christmas in July | Santa Tracker — Santa Radio'
    : TRACKER_TITLE;
  const description = inJuly
    ? "It's Christmas in July! See what Santa's up to mid-year — festive fun, holiday postcards, and countdown to the big night. Track Santa on Santa Radio."
    : TRACKER_DESCRIPTION;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: TRACKER_URL },
    openGraph: {
      title, description, url: TRACKER_URL, type: 'website', locale: 'en_GB',
      siteName: 'Santa Radio',
       images: [{ url: TRACKER_IMAGE, width: 1200, height: 630, alt: TRACKER_IMAGE_ALT }],
    },
    twitter: {
      card: 'summary_large_image', title, description, images: [TRACKER_IMAGE],
      site: '@wearesantaradio', creator: '@voiceoverman',
    },
  };
}
