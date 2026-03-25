import './Soundboard.css';

const PHRASES = [
  'Are you asleep',
  'Been Naughty',
  'Cookies',
  "It's Christmas",
  'Jingle Bells',
  'Making a List',
  "Tis the Season",
  'Very Quiet',
  'Yes 1',
  'Yes 2',
  'No 1',
  'No 2',
  'Happy Holidays',
  'Merry Christmas',
  'Naughty or Nice',
  'Would You Like?',
];

export default function Soundboard() {
  const handlePress = (phrase) => {
    // In a real implementation, this would play the specific Santa audio clip
    // The original site uses audio clips from their server
    console.log('Playing:', phrase);
  };

  return (
    <section className="soundboard starry-bg">
      <div className="container">
        <h2 className="section-title soundboard-title">Santa Soundboard</h2>
        <p className="section-subtitle soundboard-subtitle">
          Press the buttons to hear Santa speak! Have fun exploring festive phrases straight from the North Pole!
          <br />
          Or{' '}
          <a
            href="https://apps.apple.com/gb/app/santa-radio/id1021183593"
            target="_blank"
            rel="noopener noreferrer"
            className="soundboard-link"
          >
            <strong>download the free app</strong>
          </a>{' '}
          for even more Christmas fun!
        </p>
        <div className="soundboard-grid">
          {PHRASES.map(phrase => (
            <button
              key={phrase}
              className="soundboard-btn"
              onClick={() => handlePress(phrase)}
            >
              {phrase}
            </button>
          ))}
        </div>
      </div>
      <div className="snow-trees" />
    </section>
  );
}
