import {useEffect, useState} from 'react';
import {DAD_AGE_REVEAL_SECONDS, DAD_AGE_THEMES, drawDadAgeReveal} from '../lib/dadAgeReveal.js';

export default function DadAgeRevealPicker({artwork, age, name, value, onChange}) {
  const [preview, setPreview] = useState(null);
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    let active = true;
    drawDadAgeReveal(value, age).then(canvas => {
      if (active) setPreview(canvas ? {theme: value, image: canvas.toDataURL()} : null);
    }).catch(() => { if (active) setPreview(null); });
    return () => { active = false; };
  }, [value, age]);

  return <section className="dad-age-picker" aria-labelledby="dad-age-picker-title">
    <h4 id="dad-age-picker-title">What would Dad least like to see on his Christmas Message?</h4>
    <p>Pick one and we’ll give him a little surprise.</p>
    <div className="dad-age-choices">
      {DAD_AGE_THEMES.map(theme => <button key={theme.id} type="button"
        aria-pressed={value === theme.id} onClick={() => { onChange(theme.id); setReplay(count => count + 1); }}>
        <img className="dad-age-thumbnail" src={theme.artwork} alt="" />
        <span>{theme.label}</span>
      </button>)}
    </div>
    {value && <div className="dad-age-preview">
      <img src={artwork.src} alt={artwork.label} />
      {name && <p className="dad-age-preview-caption">We love you really, {name}!</p>}
      {preview && preview.theme === value && <img key={replay} className="dad-age-pop"
        style={{animationDuration: `${DAD_AGE_REVEAL_SECONDS}s`}}
        src={preview.image} alt={`Aged ${age} surrounded by ${DAD_AGE_THEMES.find(theme => theme.id === value).label.toLowerCase()}`} />}
    </div>}
  </section>;
}
