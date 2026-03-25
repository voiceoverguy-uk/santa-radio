import { Link } from 'react-router-dom';
import './MugshotsPreview.css';

const CELEBS = [
  { name: 'Lisa Maxwell', role: 'Actress', img: 'https://www.santaradio.co.uk/mugshot-images/lisa-maxwell-actress.jpg' },
  { name: 'Jason Manford', role: 'Comedian & Radio Presenter', img: 'https://www.santaradio.co.uk/mugshot-images/jason-manford-comedian.jpg' },
  { name: 'Jordan Banjo', role: 'Dancer', img: 'https://www.santaradio.co.uk/mugshot-images/jordan-banjo-dancer.jpg' },
  { name: 'Tom Milner', role: 'English actor', img: 'https://www.santaradio.co.uk/mugshot-images/tom-milner-actor.jpg' },
];

export default function MugshotsPreview() {
  return (
    <section className="mugshots-preview starry-bg">
      <div className="container">
        <div className="mugshots-logo">
          <img
            src="https://www.santaradio.co.uk/santa-radio-celebrity-mugshots.png"
            alt="Celebrity Mugshots"
            className="mugshots-header-img"
          />
        </div>
        <h2 className="section-title mug-title">Mug Shots</h2>
        <p className="section-subtitle mug-sub">
          We gave a Santa Radio Mug to our Autograph hunting Elf. You won't believe how many he got...
          <br />
          <Link to="/mugshots" className="mug-link">
            <strong>Click here</strong>
          </Link>{' '}
          to see over 600 more Celebs with mugs
        </p>
        <div className="mugshots-grid">
          {CELEBS.map(celeb => (
            <div key={celeb.name} className="mug-card">
              <img src={celeb.img} alt={celeb.name} className="mug-photo" />
              <div className="mug-info">
                <strong>{celeb.name}</strong>
                <span>{celeb.role}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
