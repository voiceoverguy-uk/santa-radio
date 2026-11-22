import { useLocation } from 'react-router-dom';
import PageSeo from './PageSeo.jsx';
import { pageMetadata, mugPhotoTermsPath } from './catalogue.js';
const pages = {
  '/santa-knows-christmas': ['Santa Knows Christmas | Christmas Film Guessing Game', 'Think of a Christmas film and see if Santa can guess it in 20 questions. Play the free Santa Knows Christmas game and try to beat Santa.'],
  '/naughty-or-nice-list-checker': ['Naughty or Nice List Checker & Free Certificate | Santa Radio', 'Are you on Santa’s Nice List? Take Head Elf’s free Naughty or Nice quiz and download your personalised certificate. A playful Christmas treat for families.'],
  '/christmas-contenders': ['Christmas Contenders 2026: New Christmas Songs | Santa Radio', 'Discover new Christmas songs and the artists behind them. Explore Santa Radio’s Christmas Contenders and find your next festive favourite.'],
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
  return row ? <PageSeo metadata={pageMetadata({ path: pathname, title: row[0], description: row[1] })} /> : null;
}
