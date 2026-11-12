import { useId, useState } from 'react';
export default function PronunciationNote({ value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className="name-pronunciation">
    <button type="button" className="message-retry" aria-expanded={open} aria-controls={id}
      disabled={disabled} onClick={() => setOpen(!open)}>Help Santa pronounce this name (optional)</button>
    {open && <div id={id}>
      <label htmlFor={`${id}-note`}>How do you say it?</label>
      <p id={`${id}-help`}>Write it as it sounds, for example “Zara: ZAH-ruh”. Pronunciation only—please don’t include contact details.</p>
      <textarea id={`${id}-note`} value={value} disabled={disabled} maxLength={120} rows={3}
        aria-describedby={`${id}-help ${id}-count`} onChange={e => onChange(e.target.value)}
        style={{ width:'100%', boxSizing:'border-box', padding:12, borderRadius:8, font:'inherit' }} />
      <p id={`${id}-count`}>{value.length}/120 characters</p>
    </div>}
  </div>;
}
