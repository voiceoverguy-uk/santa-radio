import PageSeo from '../seo/PageSeo.jsx';
import { pageMetadata } from '../seo/catalogue.js';
import SantaMessageForm from '../components/SantaMessageForm.jsx';
import HomeHero, { useHeroNameSelection } from '../components/HomeHero.jsx';
import './Home.css';

const previewMetadata = pageMetadata({
  path: '/preview/hero-name-checker',
  title: 'Santa Radio Hero Name Checker Preview',
  description: 'A private preview of a Santa Radio homepage hero concept.',
  noindex: true,
});

export default function HeroNamePreview() {
  const { pendingName, continueWithName } = useHeroNameSelection();
  return (
    <main id="main-content" className="home-page hero-name-preview">
      <PageSeo metadata={previewMetadata} />
      <HomeHero preview onContinue={continueWithName} />
      <SantaMessageForm showDetailLink={false} keepSignupInPlace pendingName={pendingName} />
    </main>
  );
}
