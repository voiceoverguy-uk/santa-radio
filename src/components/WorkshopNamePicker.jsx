import { useEffect, useId, useRef, useState } from 'react';
import useHostedSantaNameSearch from './useHostedSantaNameSearch.js';
import './WorkshopNamePicker.css';

export default function WorkshopNamePicker({ selected, onSelect, onRefreshSelection, invalid }) {
  const generatedId = useId();
  const inputId = `smw-name-search-${generatedId}`;
  const listboxId = `${inputId}-results`;
  const [query, setQuery] = useState(() => selected?.name || '');
  const search = useHostedSantaNameSearch(query);
  const matchingRecords = search.records;
  const requestState = {
    status: search.loading ? 'loading' : search.error ? 'error' : 'ready',
    message: search.error,
  };
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimer = useRef(null);
  const optionRefs = useRef([]);

  useEffect(() => () => window.clearTimeout(blurTimer.current), []);

  useEffect(() => {
    if (selected?.name) setQuery(selected.name);
  }, [selected?.id, selected?.name]);
  useEffect(() => {
    const fresh = search.records.find(record => record.id === selected?.id);
    if (fresh && fresh.selectionToken !== selected.selectionToken) onRefreshSelection?.(fresh);
  }, [search.records, selected, onRefreshSelection]);

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
    search.refresh();
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
        Enter at least two letters to search recorded names.
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
          {query.trim().length >= 2 && matchingRecords.length === 0 && (
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
            && matchingRecords.length === 10
            && <p className="smw-name-refine">Showing up to 10 matches. Add more letters to refine the list.</p>}
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
