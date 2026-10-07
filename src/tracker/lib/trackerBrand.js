// Verified current Santa Radio published host. Update this when its domain moves.
export const TRACKER_ORIGIN = 'https://santa-radio.replit.app';
export const TRACKER_URL = `${TRACKER_ORIGIN}/santa-tracker`;
export const TRACKER_DISPLAY_URL = 'santa-radio.replit.app/santa-tracker';
export const TRACKER_IMAGE = `${TRACKER_ORIGIN}/images/santa-radio-logo.png`;
export const SANTA_VOICE_URL = 'https://www.santaguy.co.uk/hire-santa-voice';

export function getTrackerMetadata(now = new Date()) {
  const inJuly = now.getUTCMonth() === 6;
  const title = inJuly
    ? 'Christmas in July | Santa Tracker — Santa Radio'
    : "Santa Tracker | Track Santa's Journey — Santa Radio";
  const description = inJuly
    ? "It's Christmas in July! See what Santa's up to mid-year — festive fun, holiday postcards, and countdown to the big night. Track Santa on Santa Radio."
    : "Follow Santa's estimated Christmas Eve journey around the world, with a countdown, updating world map, festive facts and family fun from Santa Radio.";
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: TRACKER_URL },
    openGraph: {
      title, description, url: TRACKER_URL, type: 'website', locale: 'en_GB',
      siteName: 'Santa Radio',
      images: [{ url: TRACKER_IMAGE, width: 827, height: 190, alt: 'Santa Radio' }],
    },
    twitter: {
      card: 'summary_large_image', title, description, images: [TRACKER_IMAGE],
      site: '@wearesantaradio', creator: '@voiceoverman',
    },
  };
}
