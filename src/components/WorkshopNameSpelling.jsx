import { useEffect, useId, useRef, useState } from 'react';
import {
  getWorkshopDownloadName,
  getWorkshopWrittenName,
  validateWorkshopSpelling,
} from '../lib/workshopNameSpelling.js';
import WorkshopSpellingSuggestion from './WorkshopSpellingSuggestion.jsx';
import { normaliseRequestedName } from '../lib/santaNameRequests.js';
import './WorkshopNameSpelling.css';

export default function WorkshopNameSpelling({ recordedName, spelling, recordingId, onChange }) {
  const fieldId = useId();
  const inputRef = useRef(null);
  const changeButtonRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const writtenName = getWorkshopWrittenName(recordedName, spelling);
  const downloadName = getWorkshopDownloadName(recordedName, spelling);
  const canSuggestSpelling = !!spelling
    && !validateWorkshopSpelling(spelling)
    && normaliseRequestedName(writtenName)?.key !== normaliseRequestedName(recordedName)?.key;

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const returnFocus = () => {
    window.requestAnimationFrame(() => changeButtonRef.current?.focus());
  };

  const beginEditing = () => {
    setDraft(spelling || recordedName);
    setError('');
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setError('');
    setIsEditing(false);
    returnFocus();
  };

  const commitSpelling = event => {
    event.preventDefault();
    const validationError = validateWorkshopSpelling(draft);
    if (validationError) {
      setError(validationError);
      inputRef.current?.focus();
      return;
    }
    onChange(draft.trim());
    setError('');
    setIsEditing(false);
    returnFocus();
  };

  const useRecordedSpelling = () => {
    onChange('');
    setDraft('');
    setError('');
    setIsEditing(false);
    returnFocus();
  };

  return (
    <section className="smw-written-name" aria-label="Written name for your keepsakes" data-download-name={downloadName}>
      <div className="smw-written-name-header">
        <div className="smw-written-name-record">
          <span className="smw-written-name-record-label">Recorded name</span>
          <strong>{recordedName}</strong>
        </div>
      </div>

      <dl className="smw-written-name-previews">
        <div className="smw-written-name-preview">
          <dt>Certificate name preview</dt>
          <dd>
            <span className="smw-written-name-value">{writtenName}</span>
            <button
              ref={changeButtonRef}
              className="smw-change smw-written-name-edit"
              type="button"
              onClick={beginEditing}
              aria-label="Edit certificate name"
              aria-expanded={isEditing}
              aria-controls={`${fieldId}-editor`}
              title="Edit certificate name"
            >
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="m16 4 4 4M4 20l4-1 12-12a2.83 2.83 0 0 0-4-4L4 15z" />
              </svg>
            </button>
          </dd>
        </div>
      </dl>

      {isEditing && (
        <form id={`${fieldId}-editor`} className="smw-written-name-editor" onSubmit={commitSpelling} noValidate>
          <label className="smw-written-name-label" htmlFor={fieldId}>Name spelling</label>
          <input
            ref={inputRef}
            id={fieldId}
            className="smw-written-name-input"
            type="text"
            maxLength={160}
            value={draft}
            onChange={event => {
              setDraft(event.target.value);
              if (error) setError('');
            }}
            aria-invalid={!!error}
            aria-describedby={error ? `${fieldId}-error` : undefined}
            autoComplete="off"
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelEditing();
              }
            }}
          />
          {error && <p className="smw-written-name-error" id={`${fieldId}-error`} role="alert">{error}</p>}
          <div className="smw-written-name-controls">
            <button className="smw-written-name-button" type="submit">Use this spelling</button>
            <button className="smw-written-name-reset" type="button" onClick={cancelEditing}>Cancel</button>
            {spelling && <button className="smw-written-name-reset" type="button" onClick={useRecordedSpelling}>Use recorded spelling</button>}
          </div>
        </form>
      )}

      {canSuggestSpelling && (
        <WorkshopSpellingSuggestion
          name={writtenName}
          recordingId={recordingId}
          recordedName={recordedName}
        />
      )}
    </section>
  );
}
