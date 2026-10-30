import { useId, useRef, useState } from 'react';
import useHostedSantaNameSearch from './useHostedSantaNameSearch.js';

export default function HeroNameChecker({ onContinue }) {
  const id = useId();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [validation, setValidation] = useState('');
  const inputRef = useRef(null);
  const touch = useRef(null);
  const suppressClick = useRef(false);
  const search = useHostedSantaNameSearch(name);
  const options = search.records;
  const expanded = open && options.length > 0 && !search.loading && !search.error;
  const choose = record => {
    setValidation('');
    setName(record.name);
    setSelected(record);
    setOpen(false);
    setActive(-1);
  };
  const status = selected ? `Yes! Santa can record for ${selected.name}.`
    : search.loading ? 'Checking Santa’s recorded names…'
      : search.error ? search.error
        : name.trim() && !options.length
          ? 'We haven’t found that spelling. Try a shorter name or another spelling.'
          : name.trim() ? `${options.length} matching ${options.length === 1 ? 'name' : 'names'}. Choose a name from the list.`
            : 'Search Santa’s recorded names, then choose a match.';

  return <section className="hero-name-checker" aria-labelledby={`${id}-title`}>
    <p className="hero-name-checker__eyebrow">A free message from Santa</p>
    <h2 id={`${id}-title`}>Does Santa have your child’s name?</h2>
    <form noValidate onSubmit={event => {
      event.preventDefault();
      if (!selected) {
        setValidation(name.trim()
          ? search.error || (search.loading
            ? 'Please wait while Santa checks the name list.'
            : 'Please choose one of Santa’s recorded names from the list.')
          : 'Please enter a child’s name, then choose a suggestion.');
        inputRef.current?.focus({ preventScroll: true });
        setOpen(true);
        return;
      }
      setValidation('');
      onContinue(selected.name);
    }}>
      <label htmlFor={id}>Child’s first name</label>
      <div className="hero-name-checker__picker">
        <input ref={inputRef} id={id} type="text" role="combobox" value={name}
          placeholder="Start typing a name…" autoComplete="off" autoCapitalize="words"
          spellCheck={false} maxLength={80} aria-autocomplete="list" aria-expanded={expanded}
          aria-controls={expanded ? `${id}-options` : undefined}
          aria-activedescendant={expanded && active >= 0 && options[active] ? `${id}-option-${active}` : undefined}
          aria-describedby={`${id}-status`}
          aria-invalid={!!validation}
          onChange={event => { setName(event.target.value); setSelected(null); setValidation(''); setActive(-1); setOpen(true); }}
          onFocus={() => { if (!selected) setOpen(true); }}
          onBlur={() => { if (!touch.current) setOpen(false); }}
          onKeyDown={event => {
            if (event.key === 'Escape') { setOpen(false); setActive(-1); }
            if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && options.length) {
              event.preventDefault(); setOpen(true);
              const next = active < 0 ? (event.key === 'ArrowDown' ? 0 : options.length - 1)
                : (active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
              setActive(next);
              requestAnimationFrame(() => document.getElementById(`${id}-option-${next}`)?.scrollIntoView({ block: 'nearest' }));
            }
            if (event.key === 'Enter' && expanded && active >= 0 && options[active]) {
              event.preventDefault(); choose(options[active]);
            }
          }} />
        {expanded && <ul id={`${id}-options`} role="listbox" aria-label="Matching recorded names">
          {options.map((record, index) => <li key={record.id} id={`${id}-option-${index}`}
            role="option" aria-selected={active === index}
            onPointerDown={event => {
              event.preventDefault();
              suppressClick.current = event.pointerType === 'touch';
              touch.current = event.pointerType === 'touch'
                ? { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false } : null;
            }}
            onPointerMove={event => {
              if (touch.current && Math.hypot(event.clientX - touch.current.x, event.clientY - touch.current.y) > 10) touch.current.moved = true;
            }}
            onPointerUp={event => {
              const start = touch.current; touch.current = null;
              if (start?.pointerId === event.pointerId && !start.moved) { event.preventDefault(); choose(record); }
            }}
            onPointerCancel={() => { touch.current = null; }}
            onClick={event => { if (!suppressClick.current || event.detail === 0) choose(record); }}>
            {record.name}{record.variant && <small> — {record.variant}</small>}
          </li>)}
        </ul>}
      </div>
      <p className={`hero-name-checker__status${validation ? ' hero-name-checker__status--error' : ''}`} id={`${id}-status`} role="status" aria-live="polite" aria-atomic="true">{validation || status}</p>
      {search.error && <button type="button" className="hero-name-checker__retry" onClick={search.refresh}>Retry name search</button>}
      <button className="btn-red hero-name-checker__submit" type="submit">Create my free Santa message →</button>
    </form>
  </section>;
}
