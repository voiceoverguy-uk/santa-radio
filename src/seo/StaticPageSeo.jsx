import { useLocation } from 'react-router-dom';
import PageSeo from './PageSeo.jsx';
import { pageMetadata } from './catalogue.js';
const pages = {
  '/privacy-policy': ['Privacy Policy | Santa Radio', 'Read how Santa Radio handles privacy, website information and optional submissions.'],
  '/submit-a-song': ['Suggest a Christmas Song | Santa Radio', 'Suggest a Christmas recording for Santa Radio’s music catalogue.'],
  '/links': ['Christmas Links | Santa Radio', 'Explore the festive websites and services linked by Santa Radio.'],
  '/santa-stories': ['Santa Stories | Santa Radio', 'Explore Santa Radio’s Santa stories and festive listening.'],
};
export default function StaticPageSeo() {
  const { pathname } = useLocation();
  const row = pages[pathname];
  return row ? <PageSeo metadata={pageMetadata({ path: pathname, title: row[0], description: row[1] })} /> : null;
}
