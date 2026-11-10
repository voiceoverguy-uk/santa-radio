import naughtyNiceCheck from '../assets/apps/naughty-nice-check.jpg';
import naughtyNiceResult from '../assets/apps/naughty-nice-result.jpg';
import naughtyNiceElf from '../assets/apps/naughty-nice-elf.jpg';
import naughtyNiceWelcome from '../assets/apps/naughty-nice-welcome.jpg';
import santaRadio from '../assets/apps/santa-radio-ios-radio.webp';
import santaRadioFallback from '../assets/apps/santa-radio-ios-radio.png';
import santaRadioArtists from '../assets/apps/santa-radio-ios-artists.webp';
import santaRadioArtistsFallback from '../assets/apps/santa-radio-ios-artists.png';
import santaRadioMugshots from '../assets/apps/santa-radio-ios-mugshots.webp';
import santaRadioMugshotsFallback from '../assets/apps/santa-radio-ios-mugshots.png';
import santaRadioTracker from '../assets/apps/santa-radio-ios-tracker.webp';
import santaRadioTrackerFallback from '../assets/apps/santa-radio-ios-tracker.png';
import santaRadioGames from '../assets/apps/santa-radio-ios-games.webp';
import santaRadioGamesFallback from '../assets/apps/santa-radio-ios-games.png';
import santaRadioWelcome from '../assets/apps/santa-radio-ios-welcome.webp';
import santaRadioWelcomeFallback from '../assets/apps/santa-radio-ios-welcome.png';
import santaRadioWatchControls from '../assets/apps/santa-radio-watch-controls.webp';
import santaRadioWatchArtwork from '../assets/apps/santa-radio-watch-artwork.webp';
import santaVoicemail from '../assets/apps/santa-voicemail-home.webp';
import santaVoicemailHomeFallback from '../assets/apps/santa-voicemail-home.png';
import santaVoicemailSanta from '../assets/apps/santa-voicemail-santa-call.webp';
import santaVoicemailSantaFallback from '../assets/apps/santa-voicemail-santa-call.png';
import santaVoicemailWorkshop from '../assets/apps/santa-voicemail-workshop-call.webp';
import santaVoicemailWorkshopFallback from '../assets/apps/santa-voicemail-workshop-call.png';
import santaVoicemailNaughty from '../assets/apps/santa-voicemail-naughty-list-call.webp';
import santaVoicemailNaughtyFallback from '../assets/apps/santa-voicemail-naughty-list-call.png';
import santaVoicemailSoundboard from '../assets/apps/santa-voicemail-soundboard.webp';
import santaVoicemailSoundboardFallback from '../assets/apps/santa-voicemail-soundboard.png';
import christmasRadio from '../assets/apps/christmas-radio-screen-1.webp';
import christmasRadioPromo2 from '../assets/apps/christmas-radio-screen-2.webp';
import christmasRadioPromo3 from '../assets/apps/christmas-radio-screen-3.webp';
import christmasRadioPromo4 from '../assets/apps/christmas-radio-screen-4.webp';
import santaText from '../assets/apps/santa-text-screen-welcome.webp';
import santaTextMenu from '../assets/apps/santa-text-screen-menu.webp';
import santaTextPromotion from '../assets/apps/santa-text-screen-promotion.webp';
import santaTextChat from '../assets/apps/santa-text-screen-chat.webp';
import santaDash from '../assets/apps/santa-dash-screen.webp';
import santaDashTitle from '../assets/apps/santa-dash-title-screen.webp';
import santaDashOutfits from '../assets/apps/santa-dash-shop-outfits.webp';
import santaDashReindeer from '../assets/apps/santa-dash-shop-reindeer.webp';
import santaDashSleighs from '../assets/apps/santa-dash-shop-sleighs.webp';
import christmasRadioFallback from '../assets/apps/christmas-radio-screen-1.png';
import christmasRadioFallback2 from '../assets/apps/christmas-radio-screen-2.png';
import christmasRadioFallback3 from '../assets/apps/christmas-radio-screen-3.png';
import christmasRadioFallback4 from '../assets/apps/christmas-radio-screen-4.png';
import santaTextFallback from '../assets/apps/santa-text-screen-welcome.png';
import santaTextMenuFallback from '../assets/apps/santa-text-screen-menu.png';
import santaTextPromotionFallback from '../assets/apps/santa-text-screen-promotion.png';
import santaTextChatFallback from '../assets/apps/santa-text-screen-chat.png';
import santaDashFallback from '../assets/apps/santa-dash-screen.png';
import santaRadioMac from '../assets/apps/santa-radio-mac.webp';

// Source copy and destination URLs: https://www.santaradio.co.uk/free-christmas-apps/
// Preserve legacy URLs verbatim; a link does not guarantee current store availability.
const feature = (label, desc, icon) => ({ label, desc, icon });
const downloads = ios => [
  { platform: 'iOS', href: ios },
];
const voicemailFeatures = [
  feature('Leave a message', 'Your child can leave a recorded\nvoicemail message for Santa.', 'microphone'),
  feature('Playback', 'Playback your Childs message to\nhear what they asked Santa.', 'play'),
  feature('Santa Soundboard', 'Head Elf recorded Santa.\nPlay back some fun festive phrases.', 'sound'),
  feature('Send a message', 'Send a message to Santa and\nread other messages & replies.', 'message'),
  feature('Download price', 'Check the linked stores\nfor current pricing.', 'gift'),
  feature('Santa Radio', 'You can also listen and enjoy\nSanta Radio direct from the app.', 'radio'),
];

// The owner approved these existing screen-only portrait originals after the
// newer promotional compositions proved occluded. Dash has separate approval.
const standaloneDisplay = title => ({
  presentation: 'device',
  heading: `${title} app screen`,
  regionLabel: `${title} app screen`,
  deviceStyle: 'classic',
});

const voicemailHome = {
  label: 'Home', image: santaVoicemail, fallback: santaVoicemailHomeFallback,
  width: 1206, height: 2622,
  alt: 'Santa Voicemail app Home screen with Call Santa, Call the Workshop, Naughty List Hotline and Santa’s Soundboard signs in a snowy North Pole village.',
};
const voicemailCall = (label, image, fallback, recipient) => ({
  label, image, fallback, width: 1206, height: 2622,
  alt: `Santa Voicemail app ${label} screen showing ${recipient} at the North Pole, Calling, Mute and End Call controls.`,
});

export const christmasApps = [
  {
    id: 'santaradio',
    title: 'Santa Radio App',
    image: santaRadio,
    alt: 'Santa Radio iPhone app preview: Radio screen.',
    width: 603,
    height: 1311,
    screenshots: [
      { label: 'Radio', image: santaRadio, fallback: santaRadioFallback, width: 603, height: 1311, alt: 'Santa Radio iPhone app preview: Radio screen.' },
      { label: 'Tracker', image: santaRadioTracker, fallback: santaRadioTrackerFallback, width: 603, height: 1311, alt: 'Santa Radio iPhone app preview: Tracker screen.' },
      { label: 'MugShots', image: santaRadioMugshots, fallback: santaRadioMugshotsFallback, width: 603, height: 1311, alt: 'Santa Radio iPhone app preview: MugShots screen.' },
      { label: 'Artists', image: santaRadioArtists, fallback: santaRadioArtistsFallback, width: 603, height: 1311, alt: 'Santa Radio iPhone app preview: Artists screen.' },
      { label: 'Games', image: santaRadioGames, fallback: santaRadioGamesFallback, width: 603, height: 1311, alt: 'Santa Radio iPhone app preview: Games screen.' },
      { label: 'Welcome', image: santaRadioWelcome, fallback: santaRadioWelcomeFallback, width: 603, height: 1311, alt: 'Santa Radio iPhone app preview: Welcome screen.' },
    ],
    slideshow: {
      heading: 'Santa Radio iPhone app preview',
      regionLabel: 'Santa Radio current iOS app screenshots',
      presentation: 'device',
      interactiveMode: 'santa-radio',
    },
    downloads: downloads(
      'https://apps.apple.com/us/app/santa-radio/id1021183593',
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
    alt: voicemailHome.alt,
    width: 1206,
    height: 2622,
    presentation: 'device',
    screenshots: [
      voicemailHome,
      voicemailCall('Santa call', santaVoicemailSanta, santaVoicemailSantaFallback, 'Santa'),
      voicemailHome,
      voicemailCall('Workshop call', santaVoicemailWorkshop, santaVoicemailWorkshopFallback, 'Santa’s Workshop'),
      voicemailHome,
      voicemailCall('Naughty List call', santaVoicemailNaughty, santaVoicemailNaughtyFallback, 'the Naughty List Hotline'),
      voicemailHome,
      {
        label: 'Soundboard', image: santaVoicemailSoundboard, fallback: santaVoicemailSoundboardFallback,
        width: 1206, height: 2622,
        alt: 'Santa Voicemail app Soundboard screen with red wooden festive phrase buttons, Parents settings and bottom navigation.',
      },
    ],
    slideshow: {
      heading: 'Santa Voicemail app screenshots',
      regionLabel: 'Santa Voicemail Home, calls and Soundboard previews',
      deviceStyle: 'voicemail',
    },
    downloads: downloads(
      'https://itunes.apple.com/us/app/santa-voicemail/id586387813',
    ),
    features: voicemailFeatures,
  },
  {
    id: 'naughty-or-nice',
    title: 'Naughty or Nice List Checker',
    availability: 'Coming soon — awaiting App Store approval.',
    subtitle: 'Which list are you on? Let Head Elf investigate!',
    presentation: 'device',
    screenshots: [
      { label: 'Quick name check', image: naughtyNiceCheck, width: 603, height: 1311, alt: 'Naughty or Nice app: enter a first name for a quick North Pole check.' },
      { label: 'Your result', image: naughtyNiceResult, width: 603, height: 1311, alt: 'Duncan’s playful 67% Nice result, with a button to check with Head Elf.' },
      { label: 'Head Elf’s analyser', image: naughtyNiceElf, width: 603, height: 1311, alt: 'Head Elf’s festive analyser counts the answers to the ten-question quiz.' },
      { label: 'Welcome', image: naughtyNiceWelcome, width: 603, height: 1311, alt: 'Naughty or Nice List Checker welcome screen: Which list are you on? Powered by Santa Radio.' },
    ],
    slideshow: {
      heading: 'Naughty or Nice List Checker app screenshots',
      regionLabel: 'Naughty or Nice List Checker app previews',
    },
    downloads: [],
    features: [
      feature('Quick name check', 'Enter your first name for a playful\nNorth Pole verdict.', 'search'),
      feature('Meet Head Elf', 'Answer ten fun questions and let\nHead Elf decide which list you’re on.', 'smile'),
      feature('Your own certificate', 'Save or share a personalised\nNaughty or Nice certificate.', 'gift'),
      feature('North Pole magic', 'Festive voices, animated analysers\nand Head Elf’s reactions.', 'sound'),
      feature('Santa Radio', 'Listen to Christmas music\ninside the app.', 'radio'),
      feature('Santa Tracker', 'Visit the Santa Tracker\nfrom the app’s own navigation.', 'search'),
    ],
  },
  {
    id: 'christmasradio',
    title: 'Christmas Radio',
    subtitle: 'A simpler version of our app, Christmas music 24/7 365 days a year',
    image: christmasRadio,
    alt: 'Christmas Radio app screen showing Naughty & Nice by Sia, playback and the coming-up queue.',
    width: 520,
    height: 1130,
    // Display planes extracted from approved originals, not the older blue UI.
    screenshots: [
      { label: 'From the makers of Santa Radio', image: christmasRadio, fallback: christmasRadioFallback, width: 520, height: 1130, alt: 'Christmas Radio app screen showing Naughty & Nice by Sia, playback and the coming-up queue.' },
      { label: 'Over 100k downloads', image: christmasRadioPromo2, fallback: christmasRadioFallback2, width: 520, height: 1130, alt: 'Christmas Radio app screen showing Christmas Tree Farm by Taylor Swift, playback and the coming-up queue.' },
      { label: 'Christmas music 365 days a year', image: christmasRadioPromo3, fallback: christmasRadioFallback3, width: 520, height: 1130, alt: 'Christmas Radio app screen with Christmas Tree Farm by Taylor Swift and Santa Baby and Naughty List in the coming-up queue.' },
      { label: 'Make it feel like Christmas', image: christmasRadioPromo4, fallback: christmasRadioFallback4, width: 520, height: 1130, alt: 'Christmas Radio app settings screen with AirPlay, Snowfall, Blizzard and Festive lights options.' },
    ],
    slideshow: {
      heading: 'Christmas Radio promotional images',
      regionLabel: 'Christmas Radio promotional images',
      imageType: 'screenshot',
    },
    downloads: downloads(
      'https://itunes.apple.com/gb/app/christmas-radio-uk/id1157967613',
    ),
    features: [
      feature('Christmas Music 24/7', "The best Christmas music.\nThe classics to today's hits!", 'radio'),
      feature('Record a Message', 'Record a message. You may hear it\non Santa’s Little Helpers Show.', 'microphone'),
      feature('Share', "Share a photo of who's playing\non your favourite social media.", 'camera'),
      feature('Send a message', 'Send a message from the app and Santa will reply in 24 hours.', 'message'),
      feature('Download price', 'Check the linked stores\nfor current pricing.', 'gift'),
      feature('Background player', 'Save battery life. The app can play\nthe music in the background.', 'sound'),
    ],
  },
  {
    id: 'santatext',
    title: 'Santa Text',
    subtitle: 'Text Santa and the Father Christmas auto-bot will reply.',
    image: santaText,
    fallback: santaTextFallback,
    alt: 'Santa Text app welcome screen with Santa holding a phone beneath the northern lights, a snowy village and a Santa Dash banner.',
    width: 603,
    height: 1311,
    screenshots: [
      { label: 'Welcome', image: santaText, fallback: santaTextFallback, width: 603, height: 1311, alt: 'Santa Text app welcome screen with Santa holding a phone beneath the northern lights, a snowy village and a Santa Dash banner.' },
      { label: 'Signpost menu', image: santaTextMenu, fallback: santaTextMenuFallback, width: 603, height: 1311, alt: 'Santa Text app signpost menu screen with Text Santa, Santa Radio.co.uk, Santa Dash and Santa Radio signs in a snowy North Pole village.' },
      { label: 'Santa Dash promotion', image: santaTextPromotion, fallback: santaTextPromotionFallback, width: 603, height: 1311, alt: 'Santa Text app Santa Dash promotion screen with Santa jumping over snowy rooftops, mince pies and a View on the App Store button.' },
      { label: 'Santa chat', image: santaTextChat, fallback: santaTextChatFallback, width: 603, height: 1311, alt: 'Santa Text app chat screen with Santa Claus at the North Pole, green Santa replies, red visitor messages and a Message Santa text field over a snowy village.' },
    ],
    presentation: 'device',
    slideshow: {
      heading: 'Santa Text app screenshots',
      regionLabel: 'Santa Text app screenshots',
    },
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
    fallback: santaDashFallback,
    alt: 'Santa Dash — Back to the Grotto promotional artwork with Santa leaping snowy rooftops, mince pies, a gingerbread figure and an inflatable Santa; caption: Leap rooftops, grab mince pies and dodge the hazards!',
    width: 1488,
    height: 676,
    landscape: true,
    presentation: 'device',
    screenshots: [
      { label: 'Rooftop artwork', image: santaDash, fallback: santaDashFallback, width: 1488, height: 676,
        alt: 'Santa Dash — Back to the Grotto promotional artwork with Santa leaping snowy rooftops; caption: Leap rooftops, grab mince pies and dodge the hazards!' },
      { label: 'Title screen', image: santaDashTitle, width: 2622, height: 1206,
        alt: 'Santa Dash title screen with Tap to Start, Santa, a snowy village and the northern lights.' },
      { label: 'Santa outfits', image: santaDashOutfits, width: 2622, height: 1206,
        alt: 'Santa’s Shop outfits screen showing Classic Santa, Midnight Santa and Elf Boss.' },
      { label: 'Reindeer', image: santaDashReindeer, width: 2622, height: 1206,
        alt: 'Santa’s Shop reindeer screen showing Dasher, Dancer and Prancer.' },
      { label: 'Sleighs', image: santaDashSleighs, width: 2622, height: 1206,
        alt: 'Santa’s Shop sleighs screen showing Tea Crate, Rudolph Ride and Lantern Sledge.' },
      { label: 'Gameplay', image: '/media/santa-dash-apps-gameplay-poster.webp',
        video: '/media/santa-dash-apps-gameplay-v1.mp4', width: 1600, height: 736,
        alt: 'Silent Santa Dash gameplay recording: Santa jumps across snowy rooftops collecting mince pies, with the score and game controls visible.' },
    ],
    slideshow: {
      heading: 'Santa Dash promotional artwork',
      regionLabel: 'Santa Dash promotional artwork',
      deviceStyle: 'dark-landscape',
      imageType: 'image',
      maxWidth: 760,
      randomOrder: true,
    },
    downloads: downloads('https://itunes.apple.com/gb/app/santa-dash-from-santa-guy/id1057048397'),
    features: [
      feature('Fun Game', 'A festive jumping game.\nGreat for all ages over Christmas.', 'game'),
      feature('How far can you go?', 'See how far you can get,\nthen post your score on Twitter.', 'trophy'),
      feature('Collect the pies', 'Jump over the buildings\nand collect the mince pies. Easy?', 'pie'),
      feature('Links to other apps', 'It also links out to our other apps.\nHave you got them all yet?', 'link'),
      feature('Play with friends', 'Login to Game Centre and play with friends.\nWhy not send a challenge to others?', 'users'),
      feature('Download price', 'Check the linked App Store\nfor current pricing.', 'gift'),
    ],
  },
];

export const macAppListing = {
  id: 'santa-radio-mac',
  title: 'Santa Radio for Mac',
  downloadUrl: 'https://apps.apple.com/gb/app/santa-radio/id1025312198?mt=12',
  subtitle: 'Play Santa Radio and see the current song and artist.',
  image: santaRadioMac,
  alt: 'Santa Radio for Mac promotional artwork: Festive music for your desktop, with a laptop in a Christmas scene and icons for live Christmas music, snow effect, Xmas lights and playback controls.',
  width: 1672,
  height: 941,
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
