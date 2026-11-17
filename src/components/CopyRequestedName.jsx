import { useState } from 'react';
import { requestedRecordingName } from '../lib/santaNameRequests.js';

export default function CopyRequestedName({ name }) {
  const [notice, setNotice] = useState('');
  const formatted = requestedRecordingName(name);
  async function copy() {
    try {
      await navigator.clipboard.writeText(formatted);
      setNotice(`Copied ${formatted}`);
    } catch {
      setNotice('Could not copy. Select the name and copy it manually.');
    }
  }
  return <span>
    <button type="button" onClick={copy} title="Copy name for recording filename"
      aria-label={`Copy ${formatted}`} style={{ background: 'transparent', color: 'inherit', border: 0, padding: '6px 0', textAlign: 'left', textDecoration: 'underline', textUnderlineOffset: '3px' }}>{formatted}</button>
    <span role="status" style={{ display: 'block', fontSize: '0.8em' }}>{notice}</span>
  </span>;
}
