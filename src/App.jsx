import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Apps from './pages/Apps.jsx';
import Music from './pages/Music.jsx';
import MugShots from './pages/MugShots.jsx';
import FreeSantaMessage from './pages/FreeSantaMessage.jsx';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/apps" element={<Apps />} />
        <Route path="/music" element={<Music />} />
        <Route path="/mugshots" element={<MugShots />} />
        <Route path="/free-santa-message" element={<FreeSantaMessage />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}
