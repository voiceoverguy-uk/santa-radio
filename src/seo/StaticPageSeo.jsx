import { useLocation } from 'react-router-dom';
import PageSeo from './PageSeo.jsx';
import { pageMetadata, mugPhotoTermsPath } from './catalogue.js';
const pages = {
  '/bespoke-santa-messages': ['Bespoke Santa Messages for Kids and Dads | Santa Radio', 'Choose a personalised Christmas video for your child or a funny message for Dad. Watch examples and read reviews from Santa Radio customers.'],
  '/santa-knows-christmas': ['Santa Knows Christmas | Christmas Film Guessing Game', 'Think of a Christmas film and see if Santa can guess it in 20 questions. Play the free Santa Knows Christmas game and try to beat Santa.', { image: '/images/santa-film-cinema.jpg', imageAlt: 'Santa Knows Christmas – the Christmas film guessing game', imageWidth: 1440, imageHeight: 612, imageType: 'image/jpeg' }],
  '/naughty-or-nice-list-checker': ['Naughty or Nice List Checker & Free Certificate | Santa Radio', 'Are you on Santa’s Nice List? Take Head Elf’s free Naughty or Nice quiz and download your personalised certificate. A playful Christmas treat for families.', { image: '/images/nice-list-share-v1.jpg', imageAlt: 'Santa Radio — Naughty or Nice? Find your list. Ask Head Elf.', imageWidth: 1200, imageHeight: 630, imageType: 'image/jpeg' }],
  '/christmas-contenders': ['Christmas Contenders 2026 – Vote for your favourite | Santa Radio', 'Five artists will join our Christmas playlist. Listen to the contenders, vote for your favourite and share their song.', { image: '/images/christmas-contenders-vote-2026.jpg', imageAlt: 'Santa Radio Christmas Contenders. Five artists will join our Christmas playlist. Listen and vote for your favourite.', imageWidth: 1200, imageHeight: 630, imageType: 'image/jpeg' }],
  [mugPhotoTermsPath]: ['Photo usage and licensing | Santa Radio', 'Read the copyright and permission-required reuse terms for Santa Radio’s Mugshot photographs, with photographer credits and how to request permission.'],
  '/privacy-policy': ['Privacy Policy | Santa Radio', 'Read how Santa Radio’s website and apps handle personal information, optional cookies, embedded media and Santa message requests, plus how to contact us.'],
  '/santa-tracker/privacy': ['The Santa Tracker iOS App Privacy Policy | Santa Radio', 'Privacy information for The Santa Tracker by Santa Radio for iOS: on-device calculations, local preview settings and separate website visits.'],
  '/submit-a-song': ['Contact Santa Radio | General Enquiries & Song Submissions', 'Get in touch with Santa Radio for general enquiries or submit a Christmas recording for airplay consideration using our shared contact form.'],
  '/platforms': ['Where to Hear Santa Radio | Listening Platforms', 'Find Santa Radio on TuneIn, Live Online Radio, Radioguide.fm and radio.net. Choose where to listen to Christmas music all year round.'],
  '/santa-stories': ['Santa Text Secret Code Words | Santa Radio', 'Discover Santa Text secret code words from Santa Radio. Find out what to listen for in Santa’s messages and keep up with the latest on-air details.'],
};
export default function StaticPageSeo() {
  const { pathname } = useLocation();
  const row = pages[pathname];
  return row ? <PageSeo metadata={pageMetadata({ path: pathname, title: row[0], description: row[1], ...row[2] })} /> : null;
}
