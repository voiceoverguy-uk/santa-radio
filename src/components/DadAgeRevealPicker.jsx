import {useEffect, useId, useState} from 'react';
import {DAD_AGE_REVEAL_SECONDS, DAD_AGE_THEMES, drawDadAgeReveal} from '../lib/dadAgeReveal.js';
import './DadAgeRevealPicker.css';

export default function DadAgeRevealPicker({artwork, age, name, value, onChange, heading, previewArtwork}) {
  const titleId = useId();
  const [preview, setPreview] = useState(null);
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    let active = true;
    drawDadAgeReveal(value, age).then(canvas => {
      if (active) setPreview(canvas ? {theme: value, image: canvas.toDataURL()} : null);
    }).catch(() => { if (active) setPreview(null); });
    return () => { active = false; };
  }, [value, age]);

  return <section className="dad-age-picker" aria-labelledby={titleId}>
    <h4 id={titleId}>{heading ?? 'What would Dad least like to see on his Christmas Message?'}</h4>
    <div className="dad-age-choices">
      {DAD_AGE_THEMES.map(theme => <button key={theme.id} type="button"
        aria-pressed={value === theme.id} onClick={() => { onChange(theme.id); setReplay(count => count + 1); }}>
        <img className="dad-age-thumbnail" src={theme.artwork} alt="" />
        <span>{theme.label}</span>
      </button>)}
    </div>
    {value && <div className="dad-age-preview">
      {previewArtwork ?? <img src={artwork.src} alt={artwork.label} width="1280" height="720" />}
      {name && <p className="dad-age-preview-caption">We love you really, {name}!</p>}
      {preview && preview.theme === value && <img key={replay} className="dad-age-pop"
        style={{animationDuration: `${DAD_AGE_REVEAL_SECONDS}s`}}
        src={preview.image} alt={`Aged ${age} surrounded by ${DAD_AGE_THEMES.find(theme => theme.id === value).label.toLowerCase()}`} />}
    </div>}
  </section>;
}
