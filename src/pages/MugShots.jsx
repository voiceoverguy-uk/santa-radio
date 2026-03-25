import { useState } from 'react';
import './MugShots.css';

const CELEBS = [
  { name: 'Alexander Armstrong', role: 'Presenter', img: 'https://www.santaradio.co.uk/mugshot-images/alexander-armstrong-presenter.jpg' },
  { name: 'Bradley Walsh', role: 'TV Personality', img: 'https://www.santaradio.co.uk/mugshot-images/bradley-walsh-tv-personality.jpg' },
  { name: 'Dene Michaels', role: 'Singer', img: 'https://www.santaradio.co.uk/mugshot-images/dene-michaels-singer.jpg' },
  { name: 'Lisa Maxwell', role: 'Actress', img: 'https://www.santaradio.co.uk/mugshot-images/lisa-maxwell-actress.jpg' },
  { name: 'Jason Manford', role: 'Comedian & Radio Presenter', img: 'https://www.santaradio.co.uk/mugshot-images/jason-manford-comedian.jpg' },
  { name: 'Jordan Banjo', role: 'Dancer', img: 'https://www.santaradio.co.uk/mugshot-images/jordan-banjo-dancer.jpg' },
  { name: 'Tom Davis', role: 'Actor & Comedian', img: 'https://www.santaradio.co.uk/mugshot-images/tom-davis-actor.jpg' },
  { name: 'Stephen Hendry', role: 'Snooker player', img: 'https://www.santaradio.co.uk/mugshot-images/stephen-hendry-snooker.jpg' },
  { name: 'Neil Jones', role: 'Dancer', img: 'https://www.santaradio.co.uk/mugshot-images/neil-jones-dancer.jpg' },
  { name: 'Ben Fogle', role: 'TV personality', img: 'https://www.santaradio.co.uk/mugshot-images/ben-fogle-tv-personality.jpg' },
  { name: 'Tom Milner', role: 'English actor', img: 'https://www.santaradio.co.uk/mugshot-images/tom-milner-actor.jpg' },
  { name: 'Leona Lewis', role: 'Singer', img: 'https://www.santaradio.co.uk/mugshot-images/leona-lewis-singer.jpg' },
];

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const colors = ['#b71c1c','#1565c0','#2e7d32','#6a1b9a','#e65100','#00695c','#37474f','#c62828'];

export default function MugShots() {
  const [search, setSearch] = useState('');

  const filtered = CELEBS.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main>
      <div className="mugshots-page-hero starry-bg">
        <div className="mugshots-hero-content">
          <div className="mugshots-page-logo-wrap">
            <img
              src="https://www.santaradio.co.uk/santa-radio-celebrity-mugshots.png"
              alt="Mug Shots"
              className="mugshots-page-logo"
              onError={e => { e.target.style.display = 'none'; }}
            />
          </div>
          <h1 className="mugshots-page-title">Santa Radio Celebrity Mug Shots Hall of Fame!</h1>
          <p className="mugshots-page-sub">
            <strong>Ecurb the Elf has been out and about door stopping celebrities with our Santa Radio Mug!</strong>
          </p>
          <p className="mugshots-page-desc">
            Santa Radio's celebrity mug shots feature hundreds of famous faces from TV, radio, music, comedy and
            sport, all proudly posing with the iconic Santa Radio mug.
          </p>
          <p className="mugshots-count">
            <span className="count-num">647</span> Celebrity Mugshots and Counting...
          </p>
          <input
            type="text"
            className="mugshots-search"
            placeholder="Search for a Celebrity or Talent"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="mugshots-grid-section starry-bg">
        <div className="container mugshots-grid">
          {filtered.map((celeb, i) => (
            <div key={celeb.name} className="mugshot-card">
              <img
                src={celeb.img}
                alt={celeb.name}
                className="mugshot-photo"
                onError={e => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div
                className="mugshot-fallback"
                style={{ background: colors[i % colors.length], display: 'none' }}
              >
                {getInitials(celeb.name)}
              </div>
              <div className="mugshot-info">
                <strong>{celeb.name}</strong>
                <span>{celeb.role}</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="no-results">No celebrities found for "{search}"</p>
          )}
        </div>
      </div>
    </main>
  );
}
