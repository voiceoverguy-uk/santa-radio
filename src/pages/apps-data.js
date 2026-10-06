import santaRadio from '../assets/apps/santa-radio.jpg';
import santaVoicemail from '../assets/apps/santa-voicemail.png';
import santaMessages from '../assets/apps/santa-messages.png';
import christmasRadio from '../assets/apps/christmas-radio.png';
import sleepsTilSanta from '../assets/apps/sleeps-til-santa.png';
import santaText from '../assets/apps/santa-text.png';
import santaDash from '../assets/apps/santa-dash.png';

// Source copy and destination URLs: https://www.santaradio.co.uk/free-christmas-apps/
// Preserve legacy URLs verbatim; a link does not guarantee current store availability.
const feature = (label, desc, icon) => ({ label, desc, icon });
const downloads = (ios, amazon) => [
  { platform: 'iOS', href: ios },
  ...(amazon ? [{ platform: 'Amazon', href: amazon }] : []),
];
const voicemailFeatures = [
  feature('Leave a message', 'Your child can leave a FREE\nvoicemail message for Santa.', '\ue600'),
  feature('Playback', 'Playback your Childs message to\nhear what they asked Santa.', '\ue070'),
  feature('Santa Soundboard', 'Head Elf recorded Santa.\nPlay back some fun festive phrases.', '\ue010'),
  feature('Send a message', 'Send a message to Santa and\nread other messages & replies.', '\ue067'),
  feature('100% FREE', "It's 100% free with none of\nthose annoying adverts.", '\ue02f'),
  feature('Santa Radio', 'You can also listen and enjoy\nSanta Radio direct from the app.', '\ue062'),
];

export const christmasApps = [
  {
    id: 'santaradio',
    title: 'Santa Radio App',
    image: santaRadio,
    alt: 'Santa Radio app with Santa, live Christmas music and Listen Live, Schedule, Record Me, Selfies and Contact tabs.',
    width: 1242,
    height: 2208,
    downloads: downloads(
      'https://apps.apple.com/us/app/santa-radio/id1021183593',
      'https://www.amazon.com/App-Style-Ltd-Santa-Radio/dp/B0158MYRBM',
    ),
    features: voicemailFeatures,
  },
  {
    id: 'santavoicemail',
    title: 'Santa Voicemail',
    subtitle: 'Leave Santa a voicemail message.',
    image: santaVoicemail,
    alt: 'Santa Voicemail app screen for leaving and playing back a message for Santa.',
    width: 750,
    height: 1334,
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
      feature("Find your child's name", 'Santa will then play a\npersonal message for your child.', '\ue071'),
      feature('Share your message', 'Share your childs message on\nsocial media or by email.', '\ue009'),
      feature('Over 600 names', "Loaded with top boys & girls names.\nSubmit yours if it's missing.", '\ue001'),
      feature('FREE', "It's a free app ready to download\nwith no annoying adverts.", '\ue02f'),
      feature('Schedule a message', 'Surprise? Set to ring your child in\n10, 30, or 60 seconds.', '\ue081'),
      feature('Santa Radio', 'Listen to Santa Radio live\ndirect from our App.', '\ue062'),
    ],
  },
  {
    id: 'christmasradio',
    title: 'Christmas Radio',
    subtitle: 'A simpler version of our app, Christmas music 24/7 365 days a year',
    image: christmasRadio,
    alt: 'Christmas Radio app screen with live Christmas music and a Santa illustration.',
    width: 750,
    height: 1334,
    downloads: downloads(
      'https://itunes.apple.com/gb/app/christmas-radio-uk/id1157967613',
      'https://www.amazon.co.uk/VoiceoverGuy-Ltd-Christmas-Radio/dp/B01M18XUXV',
    ),
    features: [
      feature('Christmas Music 24/7', "The best Christmas music.\nThe classics to today's hits!", '\ue062'),
      feature('Record a Message', 'Record a message. You may hear it\non Santa’s Little Helpers Show.', '\ue063'),
      feature('Share', "Share a photo of who's playing\non your favourite social media.", '\ue00b'),
      feature('Send a message', 'Send a message from the app and Santa will reply in 24 hours.', '\ue01e'),
      feature('100% FREE', "It's 100% free to download\nand totally commercial free.", '\ue02f'),
      feature('Background player', 'Save battery life. The app can play\nthe music in the background.', '\ue010'),
    ],
  },
  {
    id: 'sleepstilsanta',
    title: 'Sleeps til Santa',
    subtitle: 'How many sleeps til Santa?',
    image: sleepsTilSanta,
    alt: 'Sleeps til Santa app showing the Christmas countdown and Santa’s face.',
    width: 750,
    height: 1334,
    downloads: downloads(
      'https://itunes.apple.com/gb/app/sleeps-to-santa/id949843943',
      'https://www.amazon.co.uk/App-Style-Ltd-Sleeps-Santa/dp/B00R2PU0BA',
    ),
    features: [
      feature('Sleeps to go', 'The app shows how many sleeps\nthere are til Santa will arrive.', '\ue075'),
      feature('Share on Facebook', 'Share how many sleeps on\nyour facebook page.', '\ue00b'),
      feature('Catchy Tune', "Play the Sleeps to Santa song,\njust press Santa's Face.", '\ue071'),
      feature('Share on Twitter', 'Share how many sleeps to go on\nyour twitter page.', '\ue009'),
      feature('See the lyrics', 'See the lyrics to his song and\na sing a long with Santa.', '\ue030'),
      feature('100% FREE', "It's 100% free with\nno silly irrelevant adverts.", '\ue02f'),
    ],
  },
  {
    id: 'santatext',
    title: 'Santa Text',
    subtitle: 'Text Santa and the Father Christmas auto-bot will reply.',
    image: santaText,
    alt: 'Santa Text app showing a text conversation with Santa.',
    width: 750,
    height: 1334,
    downloads: downloads('https://itunes.apple.com/gb/app/santa-text/id1024535991'),
    features: [
      feature('Text Santa', 'You can have a full text chat\nwith Santa. Watch him reply.', '\ue062'),
      feature('Free Festive Fun', 'Reply with funny answers.\nSee what Santa says back.', '\ue09b'),
      feature('No charges', "The text's are automatic and replies\nare made by the Santa auto-bot.", '\ue617'),
      feature('Santa Radio', 'Enjoy listening to Santa Radio\ndirect from the app too.', '\ue062'),
      feature('No call charges', 'No internet required. Its all done\nwith a little Santa magic.', '\ue017'),
      feature('Code Words', 'Get the secret code words from\nFacebook to unlock more fun.', '\ue08f'),
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
      feature('Fun Game', 'Great free fun festive game.\nGreat for all ages over Christmas.', '\ue01b'),
      feature('How far can you go?', 'See how far you can get,\nthen post your score on Twitter.', '\ue009'),
      feature('Collect the pies', 'Jump over the buildings\nand collect the mince pies. Easy?', '\ue09e'),
      feature('Links to other apps', 'It also links out to our other apps.\nHave you got them all yet?', '\ue067'),
      feature('Play with friends', 'Login to Game Centre and play with friends.\nWhy not send a challenge to others?', '\ue001'),
      feature('100% FREE', "It's 100% free with no annoying adverts.\nWe know... how do we do it?", '\ue02f'),
    ],
  },
];
