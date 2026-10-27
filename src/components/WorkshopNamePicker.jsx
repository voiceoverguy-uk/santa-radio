import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { santaNameKey } from '../lib/santaNameSearch.js';
import './WorkshopNamePicker.css';

const REQUEST_TIMEOUT_MS = 15000;
const DISPLAY_LIMIT = 20;

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The hosted name list returned an unreadable response.');
  }
  if (payload.warning !== null) {
    const warning = typeof payload.warning === 'string' && payload.warning.trim()
      ? ` ${payload.warning.trim()}`
      : '';
    throw new Error(`The hosted name list reported a warning.${warning}`);
  }
  if (!Array.isArray(payload.records)
    || typeof payload.hostedCount !== 'number'
    || !Number.isInteger(payload.hostedCount)
    || payload.hostedCount < 0
    || payload.hostedCount !== payload.records.length) {
    throw new Error('The hosted name list is incomplete or malformed.');
  }
  const ids = new Set();
  const records = payload.records.map(record => {
    if (!record
      || typeof record !== 'object'
      || (typeof record.id !== 'string' && typeof record.id !== 'number')
      || String(record.id).trim() === ''
      || typeof record.name !== 'string'
      || record.name.trim() === ''
      || (record.variant !== undefined && record.variant !== null && typeof record.variant !== 'string')) {
      throw new Error('The hosted name list contains a malformed record.');
    }
    const identity = String(record.id);
    if (ids.has(identity)) throw new Error('The hosted name list contains duplicate record identities.');
    ids.add(identity);
    return {
      ...record,
      id: record.id,
      name: record.name,
      variant: typeof record.variant === 'string' ? record.variant : '',
    };
  });
  return { records, hostedCount: payload.hostedCount };
}

export default function WorkshopNamePicker({ selected, onSelect, invalid }) {
  const generatedId = useId();
  const inputId = `smw-name-search-${generatedId}`;
  const listboxId = `${inputId}-results`;
  const [query, setQuery] = useState(() => selected?.name || '');
  const [retryCount, setRetryCount] = useState(0);
  const [records, setRecords] = useState([]);
  const [hostedCount, setHostedCount] = useState(null);
  const [requestState, setRequestState] = useState({ status: 'loading', message: '' });
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimer = useRef(null);
  const optionRefs = useRef([]);

  useEffect(() => () => window.clearTimeout(blurTimer.current), []);

  useEffect(() => {
    if (selected?.name) setQuery(selected.name);
  }, [selected?.id, selected?.name]);

  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    setRequestState({ status: 'loading', message: '' });

    async function loadHostedNames() {
      try {
        const response = await fetch('/api/santa-names?inventory=hosted', {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`The hosted name list could not be loaded (status ${response.status}).`);
        let payload;
        try {
          payload = await response.json();
        } catch {
          throw new Error('The hosted name list returned invalid data.');
        }
        const result = validatePayload(payload);
        if (!controller.signal.aborted) {
          setRecords(result.records);
          setHostedCount(result.hostedCount);
          setRequestState({ status: 'ready', message: '' });
        }
      } catch (error) {
        if (controller.signal.aborted && !timedOut) return;
        setRecords([]);
        setHostedCount(null);
        setRequestState({
          status: 'error',
          message: timedOut
            ? 'The hosted name list took too long to respond. Please try again.'
            : error instanceof Error
              ? error.message
              : 'The hosted name list could not be loaded. Please try again.',
        });
      } finally {
        window.clearTimeout(timeout);
      }
    }
    loadHostedNames();
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [retryCount]);

  const matchingRecords = useMemo(() => {
    const normalizedQuery = santaNameKey(query);
    if (!normalizedQuery || requestState.status !== 'ready') return [];
    return records
      .filter(record => santaNameKey(record.name).startsWith(normalizedQuery))
      .slice(0, DISPLAY_LIMIT);
  }, [query, records, requestState.status]);

  const selectedIdentity = selected?.id == null ? null : String(selected.id);
  const validationId = invalid ? 'smw-validation' : undefined;
  const showListbox = isOpen && matchingRecords.length > 0 && requestState.status === 'ready';

  function handleSearchChange(event) {
    setQuery(event.target.value);
    setActiveIndex(-1);
    setIsOpen(true);
    if (selected) onSelect(null);
  }

  function chooseRecord(record) {
    window.clearTimeout(blurTimer.current);
    setQuery(record.name);
    setActiveIndex(-1);
    setIsOpen(false);
    onSelect(record);
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!matchingRecords.length || requestState.status !== 'ready') return;
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex(current => {
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        return current < 0
          ? direction > 0 ? 0 : matchingRecords.length - 1
          : (current + direction + matchingRecords.length) % matchingRecords.length;
      });
      return;
    }
    if (event.key === 'Enter' && showListbox && activeIndex >= 0) {
      event.preventDefault();
      chooseRecord(matchingRecords[activeIndex]);
    }
  }

  function handleRetry() {
    setRequestState({ status: 'loading', message: '' });
    setRetryCount(count => count + 1);
  }

  useEffect(() => {
    if (activeIndex >= 0) optionRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex]);

  return (
    <div className="smw-name-picker">
      <label className="smw-name-search-label" htmlFor={inputId}>Search recorded names</label>
      <div className="smw-name-combobox">
        <input
          id={inputId}
          className="smw-name-search"
          type="text"
          role="combobox"
          maxLength={80}
          value={query}
          onChange={handleSearchChange}
          onFocus={() => {
            window.clearTimeout(blurTimer.current);
            setIsOpen(true);
          }}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => {
              setIsOpen(false);
              setActiveIndex(-1);
            }, 120);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Start typing a name"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showListbox}
          aria-controls={listboxId}
          aria-activedescendant={showListbox && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          aria-describedby={validationId}
          aria-invalid={!!invalid}
        />
        {showListbox && (
          <ul className="smw-name-dropdown" id={listboxId} role="listbox" aria-label="Recorded names">
            {matchingRecords.map((record, index) => {
              const isSelected = selectedIdentity === String(record.id);
              const isActive = activeIndex === index;
              return (
                <li
                  ref={node => { optionRefs.current[index] = node; }}
                  id={`${listboxId}-option-${index}`}
                  className={`smw-name-option${isActive ? ' is-active' : ''}${isSelected ? ' is-selected' : ''}`}
                  key={String(record.id)}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => chooseRecord(record)}
                >
                  <span>{record.name}</span>
                  {record.variant && <small>{record.variant}</small>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="smw-name-count" aria-live="polite">
        {hostedCount === null
          ? requestState.status === 'error' ? 'Hosted name total unavailable.' : 'Hosted recordings are being checked.'
          : `${hostedCount.toLocaleString('en-GB')} hosted recordings available`}
      </p>

      {requestState.status === 'loading' && (
        <div className="smw-name-loading" role="status" aria-live="polite">
          <span className="smw-visually-hidden">Loading hosted recorded names.</span>
          <div className="smw-name-skeletons" aria-hidden="true">
            <span className="smw-name-skeleton" />
            <span className="smw-name-skeleton" />
          </div>
        </div>
      )}

      {requestState.status === 'error' && (
        <div className="smw-name-error-panel" role="alert">
          <p>{requestState.message}</p>
          <button className="smw-name-retry" type="button" onClick={handleRetry}>Retry hosted list</button>
        </div>
      )}

      {requestState.status === 'ready' && (
        <>
          {santaNameKey(query) && matchingRecords.length === 0 && (
            <div className="smw-name-empty" role="status">
              <p>Santa has not recorded “{query.trim()}” yet. Try another spelling or refine your search.</p>
              <p className="smw-name-soundalike">
                As this is a recorded message, could a name spelt differently sound the same?
                Try that spelling and choose a suitable recording. You can change the written
                spelling at the end for the certificate name and MP3 filename. This won’t change
                the name Santa says.
              </p>
            </div>
          )}
          {matchingRecords.length > 0
            && records.filter(record => santaNameKey(record.name).startsWith(santaNameKey(query))).length > DISPLAY_LIMIT
            && <p className="smw-name-refine">Showing the first {DISPLAY_LIMIT} matches. Add more letters to refine the list.</p>}
        </>
      )}

      {selected && (
        <p className="smw-name-status" aria-live="polite">
          Selected name: <strong>{selected.name}{selected.variant ? ` — ${selected.variant}` : ''}</strong>
        </p>
      )}
    </div>
  );
}
