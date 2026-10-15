import santaRadio from '../assets/apps/santa-radio-ios-radio.webp';
import santaRadioArtists from '../assets/apps/santa-radio-ios-artists.webp';
import santaRadioMugshots from '../assets/apps/santa-radio-ios-mugshots.webp';
import santaRadioTracker from '../assets/apps/santa-radio-ios-tracker.webp';
import santaRadioWatchControls from '../assets/apps/santa-radio-watch-controls.webp';
import santaRadioWatchArtwork from '../assets/apps/santa-radio-watch-artwork.webp';
import santaVoicemail from '../assets/apps/santa-voicemail-promo.webp';
import santaMessages from '../assets/apps/santa-messages.png';
import christmasRadio from '../assets/apps/christmas-radio-promo-1.webp';
import christmasRadioPromo2 from '../assets/apps/christmas-radio-promo-2.webp';
import christmasRadioPromo3 from '../assets/apps/christmas-radio-promo-3.webp';
import christmasRadioPromo4 from '../assets/apps/christmas-radio-promo-4.webp';
import santaText from '../assets/apps/santa-text-promo.webp';
import santaDash from '../assets/apps/santa-dash.png';
import santaRadioMac from '../assets/apps/santa-radio-mac.webp';

// Source copy and destination URLs: https://www.santaradio.co.uk/free-christmas-apps/
// Preserve legacy URLs verbatim; a link does not guarantee current store availability.
const feature = (label, desc, icon) => ({ label, desc, icon });
const downloads = (ios, amazon) => [
  { platform: 'iOS', href: ios },
  ...(amazon ? [{ platform: 'Amazon', href: amazon }] : []),
];
const voicemailFeatures = [
  feature('Leave a message', 'Your child can leave a recorded\nvoicemail message for Santa.', 'microphone'),
  feature('Playback', 'Playback your Childs message to\nhear what they asked Santa.', 'play'),
  feature('Santa Soundboard', 'Head Elf recorded Santa.\nPlay back some fun festive phrases.', 'sound'),
  feature('Send a message', 'Send a message to Santa and\nread other messages & replies.', 'message'),
  feature('Download price', 'Check the verified store details above.\nPrices differ between platforms.', 'gift'),
  feature('Santa Radio', 'You can also listen and enjoy\nSanta Radio direct from the app.', 'radio'),
];

export const christmasApps = [
  {
    id: 'santaradio',
    title: 'Santa Radio App',
    image: santaRadio,
    alt: 'Current Santa Radio iOS Radio screen with Michael Bublé song artwork, play button and Christmas countdown.',
    width: 660,
    height: 1434,
    screenshots: [
      { label: 'Radio', image: santaRadio, width: 660, height: 1434, alt: 'Current Santa Radio iOS Radio screen with Michael Bublé song artwork, play button and Christmas countdown.' },
      { label: 'Artists', image: santaRadioArtists, width: 660, height: 1434, alt: 'Current Santa Radio iOS Artists screen with festive portraits of Wizzard, Toni Braxton, John Lennon, Madonna, Kylie Minogue and Ed Sheeran.' },
      { label: 'MugShots', image: santaRadioMugshots, width: 660, height: 1434, alt: 'Current Santa Radio iOS MugShots screen with celebrities including Lee Mack, Greg James and Idris Elba holding Santa Radio mugs.' },
      { label: 'Tracker', image: santaRadioTracker, width: 660, height: 1434, alt: 'Current Santa Radio iOS Tracker screen with a world map and Santa’s holiday location in St Lucia.' },
    ],
    downloads: downloads(
      'https://apps.apple.com/us/app/santa-radio/id1021183593',
      'https://www.amazon.com/App-Style-Ltd-Santa-Radio/dp/B0158MYRBM',
    ),
    features: [
      feature('Christmas music', 'Listen to Christmas music\naround the clock.', 'radio'),
      feature('Now playing', 'See the current artist and song\nand what is coming up next.', 'play'),
      feature('Background player', 'Keep listening while using other apps\nor locking your screen.', 'sound'),
      feature('Sleep timer', 'Set a timer for your\nChristmas listening.', 'clock'),
      feature('Free on iOS', 'No subscription or in-app purchases\nin the verified Apple listing.', 'gift'),
      feature('Santa Tracker', 'Explore the Santa Tracker\nin the current iOS app.', 'search'),
    ],
  },
  {
    id: 'santavoicemail',
    title: 'Santa Voicemail',
    subtitle: 'Leave Santa a voicemail message.',
    image: santaVoicemail,
    alt: 'Santa Voicemail promotional artwork with Santa, a phone showing Call Santa, Call the Workshop, Naughty List Hotline and Santa Soundboard, and a Download Now banner.',
    width: 851,
    height: 1849,
    downloads: downloads(
      'https://itunes.apple.com/us/app/santa-voicemail/id586387813',
      'http://www.amazon.com/App-Style-Ltd-Santa-Voicemail/dp/B00QFP4B18',
    ),
    features: voicemailFeatures,
  },
  {
    id: 'santamessages',
    title: 'Santa Messages',
    subtitle: 'Santa has a personal message just for your child.',
    image: santaMessages,
    alt: 'Santa Messages app screen for choosing a child’s name and playing a personal message from Santa.',
    width: 750,
    height: 1334,
    downloads: downloads(
      'https://itunes.apple.com/gb/app/santa-messages/id1062532143',
      'http://www.amazon.co.uk/Santa-Messages-Free-Festive-Fun/dp/B019MRFDDK',
    ),
    features: [
      feature("Find your child's name", 'Santa will then play a\npersonal message for your child.', 'search'),
      feature('Share your message', 'Share your childs message on\nsocial media or by email.', 'share'),
      feature('Over 600 names', "Loaded with top boys & girls names.\nSubmit yours if it's missing.", 'users'),
      feature('Download price', 'Check the verified store details above.\nPrices differ between platforms.', 'gift'),
      feature('Schedule a message', 'Surprise? Set to ring your child in\n10, 30, or 60 seconds.', 'clock'),
      feature('Santa Radio', 'Listen to Santa Radio live\ndirect from our App.', 'radio'),
    ],
  },
  {
    id: 'christmasradio',
    title: 'Christmas Radio',
    subtitle: 'A simpler version of our app, Christmas music 24/7 365 days a year',
    image: christmasRadio,
    alt: 'Christmas Radio promotional image: From the makers of Santa Radio, with Santa beside a phone showing Naughty & Nice by Sia and a 24/7 Festive Favourites banner.',
    width: 851,
    height: 1849,
    // Numbered owner originals are all 851 × 1849; derivatives preserve the full artwork.
    screenshots: [
      { label: 'From the makers of Santa Radio', image: christmasRadio, width: 851, height: 1849, alt: 'Christmas Radio promotional image: From the makers of Santa Radio, with Santa beside a phone showing Naughty & Nice by Sia and a 24/7 Festive Favourites banner.' },
      { label: 'Over 100k downloads', image: christmasRadioPromo2, width: 851, height: 1849, alt: 'Christmas Radio promotional image: Over 100k Downloads, The UK’s festive soundtrack, with a phone showing Christmas Tree Farm by Taylor Swift among festive lights and presents.' },
      { label: 'Christmas music 365 days a year', image: christmasRadioPromo3, width: 851, height: 1849, alt: 'Christmas Radio promotional image: Christmas Music 365 Days a Year, Live radio, fun jingles and festive magic, with a phone showing Christmas Tree Farm by Taylor Swift.' },
      { label: 'Make it feel like Christmas', image: christmasRadioPromo4, width: 851, height: 1849, alt: 'Christmas Radio promotional image: Make It Feel Like Christmas, with a phone settings screen showing AirPlay, Snowfall, Blizzard and Festive lights options surrounded by Christmas lights.' },
    ],
    slideshow: {
      heading: 'Christmas Radio promotional images',
      regionLabel: 'Christmas Radio promotional images',
      selectionLabel: 'Choose a Christmas Radio promotional image',
      imageType: 'promotional image',
      note: 'Owner-supplied Christmas Radio promotional images, not Amazon app screenshots. Playback and settings controls shown in the artwork are not interactive website controls.',
    },
    downloads: downloads(
      'https://itunes.apple.com/gb/app/christmas-radio-uk/id1157967613',
      'https://www.amazon.co.uk/VoiceoverGuy-Ltd-Christmas-Radio/dp/B01M18XUXV',
    ),
    features: [
      feature('Christmas Music 24/7', "The best Christmas music.\nThe classics to today's hits!", 'radio'),
      feature('Record a Message', 'Record a message. You may hear it\non Santa’s Little Helpers Show.', 'microphone'),
      feature('Share', "Share a photo of who's playing\non your favourite social media.", 'camera'),
      feature('Send a message', 'Send a message from the app and Santa will reply in 24 hours.', 'message'),
      feature('Download price', 'Check the verified store details above.\nPrices differ between platforms.', 'gift'),
      feature('Background player', 'Save battery life. The app can play\nthe music in the background.', 'sound'),
    ],
  },
  {
    id: 'santatext',
    title: 'Santa Text',
    subtitle: 'Text Santa and the Father Christmas auto-bot will reply.',
    image: santaText,
    alt: 'Santa Text promotional artwork with Santa and a reindeer beside a phone showing Message Santa, Santa Postcards and Just Ask Santa, surrounded by festive lights and presents.',
    width: 851,
    height: 1849,
    downloads: downloads('https://itunes.apple.com/gb/app/santa-text/id1024535991'),
    features: [
      feature('Text Santa', 'You can have a full text chat\nwith Santa. Watch him reply.', 'message'),
      feature('Festive Fun', 'Reply with funny answers.\nSee what Santa says back.', 'smile'),
      feature('Automatic replies', 'Replies are made by the Santa auto-bot.\nPaid download; optional in-app purchases.', 'shield'),
      feature('Santa Radio', 'Enjoy listening to Santa Radio\ndirect from the app too.', 'radio'),
      feature('No call charges', 'No internet required. Its all done\nwith a little Santa magic.', 'phone'),
      feature('Code Words', 'Get the secret code words from\nFacebook to unlock more fun.', 'key'),
    ],
  },
  {
    id: 'santadash',
    title: 'Santa Dash',
    subtitle: 'How far can you go while collecting mince pies?',
    image: santaDash,
    alt: 'Santa Dash landscape game screen with Santa jumping over snowy rooftops to collect mince pies.',
    width: 1334,
    height: 750,
    landscape: true,
    downloads: downloads('https://itunes.apple.com/gb/app/santa-dash-from-santa-guy/id1057048397'),
    features: [
      feature('Fun Game', 'A festive jumping game.\nGreat for all ages over Christmas.', 'game'),
      feature('How far can you go?', 'See how far you can get,\nthen post your score on Twitter.', 'trophy'),
      feature('Collect the pies', 'Jump over the buildings\nand collect the mince pies. Easy?', 'pie'),
      feature('Links to other apps', 'It also links out to our other apps.\nHave you got them all yet?', 'link'),
      feature('Play with friends', 'Login to Game Centre and play with friends.\nWhy not send a challenge to others?', 'users'),
      feature('Download price', 'The verified UK iOS listing\nshows a £0.99 download price.', 'gift'),
    ],
  },
];

export const macAppListing = {
  id: 'santa-radio-mac',
  title: 'Santa Radio for Mac',
  subtitle: 'Play Santa Radio and see the current song and artist.',
  image: santaRadioMac,
  alt: 'Screenshot of the Santa Radio Mac app interface showing the current track, song and artist, and a Play button.',
  width: 788,
  height: 1328,
  status: 'Coming soon',
};

export const appleWatchScreenshots = [
  // Owner originals: 01-christmas-music-a-tap-away_1792060890579.png and
  // 02-see-whats-playing_1792060890579.png; both 1800 × 2600, preserved in full-size WebP derivatives.
  {
    label: 'Playback controls',
    image: santaRadioWatchControls,
    width: 1800,
    height: 2600,
    alt: 'Santa Radio Apple Watch promotional image showing White December by Kylie Minogue, song artwork and a Pause control for playback on the paired iPhone.',
  },
  {
    label: 'Song artwork',
    image: santaRadioWatchArtwork,
    width: 1800,
    height: 2600,
    alt: 'Santa Radio Apple Watch promotional image showing the song artwork, artist Kylie Minogue and title White December, sent from the paired iPhone.',
  },
];
