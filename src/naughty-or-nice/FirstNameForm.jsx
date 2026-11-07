import { useId, useRef, useState } from 'react';
import useBrowserSantaNameSearch from '../components/useBrowserSantaNameSearch.js';
import { BLOCKED_NAME_NOTE } from '../lib/nameLanguage.js';
import { nameError } from './checkerLogic.js';

export default function FirstNameForm({ initialName = '', onSubmit, buttonText = 'Check', disabled = false, label = 'First name', inlineSuggestions = false,
  suggestionHelp = 'Choose a suggestion, or play with the name you entered.' }) {
  const id = useId();
  const [name, setName] = useState(initialName);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState('');
  const input = useRef(null);
  const pointer = useRef(null);
  const search = useBrowserSantaNameSearch(name);
  const expanded = open && search.records.length > 0 && !search.loading && !search.error;
  const choose = record => {
    setName(record.name); setOpen(false); setActive(-1); setError('');
    input.current?.focus({ preventScroll: true });
  };
  const help = search.blocked ? BLOCKED_NAME_NOTE : search.loading ? 'Loading local name suggestions…'
    : search.error ? 'Suggestions are unavailable. Retry, or play using the name you entered.'
      : !name.trim() ? ''
        : name.trim().length < 2 ? 'Enter a first name.'
        : !search.records.length ? 'No matching suggestion? That’s fine — you can still play. It never means Naughty.'
          : suggestionHelp;
  return <form className="nn-name-form" noValidate autoComplete="off" onSubmit={event => {
    event.preventDefault();
    if (disabled) return;
    const message = nameError(name);
    setError(message);
    if (message) { input.current?.focus(); return; }
    setOpen(false);
    onSubmit(name.trim());
  }}>
    <label htmlFor={id}>{label}</label>
    <div className="nn-picker">
      <input id={id} ref={input} value={name} type="text" role="combobox"
        autoComplete="off" autoCapitalize="words" spellCheck={false} maxLength={80}
        disabled={disabled} placeholder="Your first name…" aria-autocomplete="list"
        aria-expanded={expanded} aria-controls={expanded ? `${id}-options` : undefined}
        aria-activedescendant={expanded && active >= 0 ? `${id}-option-${active}` : undefined}
        aria-describedby={`${id}-help`} aria-invalid={!!error || search.blocked}
        onChange={event => { setName(event.target.value); setOpen(true); setActive(-1); setError(''); }}
         onFocus={() => setOpen(true)} onBlur={() => {
           // Inline suggestions must not collapse and move a button between
           // pointer-down and click. Selection, Escape and submit still close them.
           if (!inlineSuggestions) setOpen(false);
         }}
        onKeyDown={event => {
          if (event.key === 'Escape') { setOpen(false); setActive(-1); }
          if (['ArrowDown', 'ArrowUp'].includes(event.key) && search.records.length) {
            event.preventDefault(); setOpen(true);
            const next = active < 0 ? (event.key === 'ArrowDown' ? 0 : search.records.length - 1)
              : (active + (event.key === 'ArrowDown' ? 1 : -1) + search.records.length) % search.records.length;
            setActive(next);
            requestAnimationFrame(() => document.getElementById(`${id}-option-${next}`)?.scrollIntoView({ block: 'nearest' }));
          }
          if (event.key === 'Enter' && expanded && active >= 0) {
            event.preventDefault(); choose(search.records[active]);
          }
        }} />
      {expanded && <ul id={`${id}-options`} role="listbox" aria-label="First-name suggestions">
        {search.records.map((record, index) => <li key={record.id} id={`${id}-option-${index}`}
          role="option" aria-selected={index === active}
          onPointerDown={event => {
            event.preventDefault();
            pointer.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerUp={event => {
            const start = pointer.current; pointer.current = null;
            if (start && Math.hypot(start.x - event.clientX, start.y - event.clientY) < 10) {
              event.preventDefault(); choose(record);
            }
          }}
          onPointerCancel={() => { pointer.current = null; }}
          onClick={event => { if (event.detail === 0) choose(record); }}>
          {record.name}
        </li>)}
      </ul>}
    </div>
    <p id={`${id}-help`} className={error || search.blocked ? 'nn-error' : 'nn-help'} role="status">{error || help}</p>
    {search.error && <button type="button" className="nn-secondary" disabled={disabled}
      onClick={() => { setOpen(true); input.current?.focus({ preventScroll: true }); search.refresh(); }}>Retry suggestions</button>}
    <button type="submit" className="nn-primary" disabled={disabled}>{typeof buttonText === 'function' ? buttonText(name.trim()) : buttonText}</button>
  </form>;
}
