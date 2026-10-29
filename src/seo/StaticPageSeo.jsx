import { useLocation } from 'react-router-dom';
import PageSeo from './PageSeo.jsx';
import { pageMetadata, mugPhotoTermsPath } from './catalogue.js';
const pages = {
  '/christmas-contenders': ['Christmas Contenders 2026 | Santa Radio', 'Help choose the next sound of Christmas. Explore our isolated demo before November voting for December playlist consideration.'],
  [mugPhotoTermsPath]: ['Photo usage and licensing | Santa Radio', 'Read the copyright and permission-required reuse terms for Santa Radio’s Mugshot photographs, with photographer credits and how to request permission.'],
  '/privacy-policy': ['Privacy Policy | Santa Radio', 'Read how Santa Radio handles privacy, website information and optional submissions.'],
  '/submit-a-song': ['Contact Santa Radio | General Enquiries & Song Submissions', 'Get in touch with Santa Radio for general enquiries or submit a Christmas recording for airplay consideration using our shared contact form.'],
  '/links': ['Christmas Links | Santa Radio', 'Explore the festive websites and services linked by Santa Radio.'],
  '/santa-stories': ['Santa Stories | Santa Radio', 'Explore Santa Radio’s Santa stories and festive listening.'],
};
export default function StaticPageSeo() {
  const { pathname } = useLocation();
  const row = pages[pathname];
  return row ? <PageSeo metadata={pageMetadata({ path: pathname, title: row[0], description: row[1] })} /> : null;
}
