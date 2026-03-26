import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Apps from './pages/Apps.jsx';
import Music from './pages/Music.jsx';
import MugShots from './pages/MugShots.jsx';
import MugshotDetail from './pages/MugshotDetail.jsx';
import SongDetail from './pages/SongDetail.jsx';
import KaraokeLyrics from './pages/KaraokeLyrics.jsx';
import FreeSantaMessage from './pages/FreeSantaMessage.jsx';
import SubmitASong from './pages/SubmitASong.jsx';
import Links from './pages/Links.jsx';
import SantaStories from './pages/SantaStories.jsx';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/apps" element={<Apps />} />
        <Route path="/christmas-music" element={<Music />} />
        <Route path="/mugshots/all" element={<MugShots />} />
        <Route path="/mugshots/:slug" element={<MugshotDetail />} />
        <Route path="/christmas-artist/:slug" element={<SongDetail />} />
        <Route path="/christmas-karaoke-lyrics/:slug" element={<KaraokeLyrics />} />
        <Route path="/free-santa-message" element={<FreeSantaMessage />} />
        <Route path="/submit-a-song" element={<SubmitASong />} />
        <Route path="/links" element={<Links />} />
        <Route path="/santa-stories" element={<SantaStories />} />
        <Route path="/music" element={<Navigate to="/christmas-music" replace />} />
        <Route path="/mugshots" element={<Navigate to="/mugshots/all" replace />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}
