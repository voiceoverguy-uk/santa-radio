import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import HeroNamePreview from './pages/HeroNamePreview.jsx';
import Apps from './pages/Apps.jsx';
import Music from './pages/Music.jsx';
import MugShots from './pages/MugShots.jsx';
import MugshotDetail from './pages/MugshotDetail.jsx';
import SongDetail from './pages/SongDetail.jsx';
import KaraokeLyrics from './pages/KaraokeLyrics.jsx';
import FreeSantaMessage from './pages/FreeSantaMessage.jsx';
import SantaMessageWorkshop from './pages/SantaMessageWorkshop.jsx';
import SubmitASong from './pages/SubmitASong.jsx';
import ChristmasContenders from './pages/ChristmasContenders.jsx';
import NaughtyNicePage from './naughty-or-nice/NaughtyNicePage.jsx';
import PrivacyPolicy from './pages/PrivacyPolicy.jsx';
import PhotoLicensing from './pages/PhotoLicensing.jsx';
import { mugPhotoTermsPath } from './seo/catalogue.js';
import Links from './pages/Links.jsx';
import SantaStories from './pages/SantaStories.jsx';
import ArtistDetail from './pages/ArtistDetail.jsx';
import SantaTrackerPage from './tracker/app/santa-tracker/page.tsx';
import SantaTrackerPreviewPage from './tracker/app/santa-tracker/preview/page.tsx';
import AudioPlayer from './components/AudioPlayer.jsx';
import Snowfall from './components/Snowfall.jsx';
import { RadioProvider } from './components/RadioProvider.jsx';
import { SantaMessageAccessProvider } from './components/SantaMessageAccessProvider.jsx';
import './north-pole.css';
import './north-pole-glow.css';
import NotFound from './seo/NotFound.jsx';
import StaticPageSeo from './seo/StaticPageSeo.jsx';
import MarketingConsent from './components/MarketingConsent.jsx';
import { CookieConsentProvider } from './privacy/CookieConsentProvider.jsx';
import SantaStaffShell from './components/SantaStaffShell.jsx';
import SantaMessageOffer from './components/SantaMessageOffer.jsx';
import WorkshopAccessGate from './components/WorkshopAccessGate.jsx';
import { RadioDockVisibilityProvider } from './components/RadioDockVisibility.jsx';
import SantaTrackerStreamPage from './tracker/app/styt/page.tsx';
import { isTrackerCapturePath } from './privacy/trackerPrivacy.js';

function WebsiteLayout() {
  const capture = isTrackerCapturePath(useLocation().pathname);
  return (
    <>
      {!capture && <><a href="#page-content" className="skip-link">Skip to content</a><Navbar /></>}
      <StaticPageSeo />
      {!capture && <Snowfall />}
      <div id="page-content" tabIndex={-1}><Routes>
        <Route path="/" element={<Home />} />
        <Route path="/preview/hero-name-checker" element={<HeroNamePreview />} />
        <Route path="/apps" element={<Apps />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path={mugPhotoTermsPath} element={<PhotoLicensing />} />
        <Route path="/christmas-music" element={<Music />} />
        <Route path="/mugshots/all" element={<MugShots />} />
        <Route path="/mugshots/:slug" element={<MugshotDetail />} />
        <Route path="/christmas-artist/:slug" element={<SongDetail />} />
        <Route path="/christmas-karaoke-lyrics/:slug" element={<KaraokeLyrics />} />
        <Route path="/artist" element={<ArtistDetail />} />
        <Route path="/free-santa-message" element={<FreeSantaMessage />} />
        <Route path="/santa-message-workshop" element={<WorkshopAccessGate><SantaMessageWorkshop /></WorkshopAccessGate>} />
        <Route path="/request-names" element={<SantaStaffShell mode="admin" />} />
        <Route path="/sign-in/*" element={<SantaStaffShell mode="sign-in" />} />
        <Route path="/sign-up/*" element={<SantaStaffShell mode="sign-up" />} />
        <Route path="/submit-a-song" element={<SubmitASong />} />
        <Route path="/christmas-contenders" element={<ChristmasContenders />} />
        <Route path="/naughty-or-nice-list-checker" element={<NaughtyNicePage />} />
        <Route path="/links" element={<Links />} />
        <Route path="/santa-stories" element={<SantaStories />} />
        <Route path="/santa-tracker" element={<SantaTrackerPage />} />
        <Route path="/styt" element={<SantaTrackerStreamPage />} />
        <Route path="/santa-tracker/preview" element={<SantaTrackerPreviewPage />} />
        <Route path="/music" element={<Navigate to="/christmas-music" replace />} />
        <Route path="/mugshots" element={<Navigate to="/mugshots/all" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes></div>
      {!capture && <><Footer /><AudioPlayer /></>}
      <MarketingConsent />
      <SantaMessageOffer />
    </>
  );
}

function App({ Router = BrowserRouter, routerProps = {} }) {
  return (
    <RadioProvider><SantaMessageAccessProvider><CookieConsentProvider><Router {...routerProps}><RadioDockVisibilityProvider>
      <WebsiteLayout />
    </RadioDockVisibilityProvider></Router></CookieConsentProvider></SantaMessageAccessProvider></RadioProvider>
  );
}
export default App;
