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
    returnFocus();
  };

  return (
    <section className="smw-written-name" aria-label="Written name for your keepsakes">
      <div className="smw-written-name-header">
        <div className="smw-written-name-record">
          <span className="smw-written-name-record-label">Recorded name · audio stays as chosen</span>
          <strong>{recordedName}</strong>
        </div>

        {!isEditing && (
          <div className="smw-written-name-controls">
            <button
              ref={changeButtonRef}
              className="smw-written-name-button"
              type="button"
              onClick={beginEditing}
            >
              Change spelling
            </button>
            {spelling && (
              <button
                className="smw-written-name-reset"
                type="button"
                onClick={useRecordedSpelling}
              >
                Use recorded spelling
              </button>
            )}
          </div>
        )}
      </div>

      <p className="smw-written-name-explainer">
        Spelling only; Santa’s pronunciation stays the same.
      </p>

      {isEditing && (
        <form className="smw-written-name-editor" onSubmit={commitSpelling} noValidate>
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
            aria-describedby={`${fieldId}-help${error ? ` ${fieldId}-error` : ''}`}
            autoComplete="off"
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelEditing();
              }
            }}
          />
          <p className="smw-written-name-help" id={`${fieldId}-help`}>
            Used on the certificate and in the MP3 filename only. The chosen audio recording does not change.
          </p>
          {error && <p className="smw-written-name-error" id={`${fieldId}-error`} role="alert">{error}</p>}
          <div className="smw-written-name-controls">
            <button className="smw-written-name-button" type="submit">Use this spelling</button>
            <button className="smw-written-name-reset" type="button" onClick={cancelEditing}>Cancel</button>
          </div>
        </form>
      )}

      <dl className="smw-written-name-previews">
        <div className="smw-written-name-preview">
          <dt>Certificate name preview</dt>
          <dd>{writtenName}</dd>
        </div>
        <div className="smw-written-name-preview">
          <dt>MP3 filename preview</dt>
          <dd>{downloadName}</dd>
        </div>
      </dl>
      <p className="smw-written-name-preview-note">
        Previews only. This workshop does not create a certificate or MP3.
      </p>
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
