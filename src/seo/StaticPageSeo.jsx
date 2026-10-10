import { useLocation } from 'react-router-dom';
import PageSeo from './PageSeo.jsx';
import { pageMetadata } from './catalogue.js';
const pages = {
  '/': ['Santa Radio — Christmas Music & Santa Tracker', 'Listen to Christmas music on Santa Radio. Explore Christmas song lyrics, celebrity mug photographs, Santa messages and our festive Santa Tracker.'],
  '/apps': ['Santa Radio Apps | Santa Radio', 'Explore Santa Radio apps and ways to listen to Christmas music.'],
  '/privacy-policy': ['Privacy Policy | Santa Radio', 'Read how Santa Radio handles privacy, website information and optional submissions.'],
  '/free-santa-message': ['Free Santa Audio Message | Santa Radio', 'Create a personalised MP3 Santa greeting using Santa Radio’s message maker.'],
  '/submit-a-song': ['Suggest a Christmas Song | Santa Radio', 'Suggest a Christmas recording for Santa Radio’s music catalogue.'],
  '/links': ['Christmas Links | Santa Radio', 'Explore the festive websites and services linked by Santa Radio.'],
  '/santa-stories': ['Santa Stories | Santa Radio', 'Explore Santa Radio’s Santa stories and festive listening.'],
};
export default function StaticPageSeo() {
  const { pathname } = useLocation();
  const row = pages[pathname];
  return row ? <PageSeo metadata={pageMetadata({ path: pathname, title: row[0], description: row[1] })} /> : null;
}
