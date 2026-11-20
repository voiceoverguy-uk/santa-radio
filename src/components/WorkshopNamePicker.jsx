import WorkshopMissingName from './WorkshopMissingName.jsx';
import { useEffect, useId, useRef, useState } from 'react';
import useBrowserSantaNameSearch from './useBrowserSantaNameSearch.js';
import { santaNameKey, santaNameDisplay } from '../lib/santaNameSearch.js';
import WorkshopNamePreview from './WorkshopNamePreview.jsx';
import './WorkshopNamePicker.css';

export default function WorkshopNamePicker({ selected, initialName = '', onSelect, resolution, invalid, previewCache, showAvailableCount = false, capitaliseFirstLetter = false }) {
  const generatedId = useId();
  const inputId = `smw-name-search-${generatedId}`;
  const listboxId = `${inputId}-results`;
  const [query, setQuery] = useState(() => santaNameDisplay(selected?.name || initialName));
  const pendingPrefill = useRef(!selected && Boolean(initialName));
  const search = useBrowserSantaNameSearch(query);
  const resolvingVariants = resolution.status === 'variants';
  const matchingRecords = resolvingVariants ? resolution.records : search.records;
  const requestState = {
    status: search.loading || resolution.status === 'loading' ? 'loading' : search.error || resolution.error ? 'error' : 'ready',
    message: search.error || resolution.error,
  };
  const [isOpen, setIsOpen] = useState(!selected && Boolean(initialName));
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimer = useRef(null);
  const inputRef = useRef(null);
  const optionRefs = useRef([]);

  useEffect(() => () => {
    window.clearTimeout(blurTimer.current);
  }, []);

  useEffect(() => {
    if (selected?.name) setQuery(santaNameDisplay(selected.name));
  }, [selected?.id, selected?.name]);
  useEffect(() => {
    if (!pendingPrefill.current || search.loading || search.error || resolution.status === 'loading') return;
    const exact = matchingRecords.filter(record => santaNameKey(record.name) === santaNameKey(initialName));
    if (exact.length !== 1) return;
    pendingPrefill.current = false;
    chooseRecord(exact[0]);
  }, [matchingRecords, search.loading, search.error, initialName, onSelect, resolution.status]);

  useEffect(() => {
    if (resolvingVariants) setIsOpen(true);
  }, [resolvingVariants]);

  const selectedIdentity = selected?.id == null ? null : String(selected.id);
  const validationId = invalid ? 'smw-validation' : undefined;
  const showListbox = isOpen && matchingRecords.length > 0 && requestState.status === 'ready';

  function handleSearchChange(event) {
    pendingPrefill.current = false;
    const value = event.target.value;
    setQuery(capitaliseFirstLetter ? value.replace(/^(\s*)\p{L}/u, letter => letter.toLocaleUpperCase('en-GB')) : value);
    setActiveIndex(-1);
    setIsOpen(true);
    if (selected) onSelect(null);
  }

  function chooseRecord(record) {
    pendingPrefill.current = false;
    window.clearTimeout(blurTimer.current);
    setQuery(santaNameDisplay(record.name));
    setActiveIndex(-1);
    setIsOpen(false);
    onSelect(record);
    // Release the software keyboard after an explicit choice, not while typing.
    // Keep desktop keyboard focus in the combobox for accessible navigation.
    if (window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches) {
      inputRef.current?.blur();
    }
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
    window.clearTimeout(blurTimer.current);
    setIsOpen(true);
    inputRef.current?.focus({ preventScroll: true });
    if (resolution.error) {
      resolution.retry();
      return;
    }
    search.refresh();
  }

  useEffect(() => {
    if (activeIndex >= 0) optionRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex]);

  return (
    <div className="smw-name-picker">
      <label className="smw-name-search-label" htmlFor={inputId}>{showAvailableCount && search.availableCount !== null ? `Search ${search.availableCount.toLocaleString('en-GB')} available names` : 'Search recorded names'}</label>
      <div className="smw-name-combobox">
        <input
          ref={inputRef}
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
          autoCapitalize={capitaliseFirstLetter ? "words" : "off"}
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
                  <span>{santaNameDisplay(record.name)}</span>
                  {record.variant && <small>{record.variant}</small>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {requestState.status === 'loading' && (
        <div className="smw-name-loading" role="status" aria-live="polite">
          <svg className="smw-name-loading-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9 4.9 19.1M9 3l3 3 3-3M9 21l3-3 3 3M3 9l3 3-3 3M21 9l-3 3 3 3" />
          </svg>
          <span>Finding Santa’s recording…</span>
        </div>
      )}

      {requestState.status === 'error' && (
        <div className="smw-name-error-panel" role="alert">
          <p>{requestState.message}</p>
          <button className="smw-name-retry" type="button" onClick={handleRetry}>Retry name search</button>
        </div>
      )}
      {search.warning && (
        <div className="smw-name-error-panel" role="status">
          <p>{search.warning}</p>
          <p>The full recorded-name list could not be checked. Available suggestions may be incomplete.</p>
          <button className="smw-name-retry" type="button" onClick={handleRetry}>Retry name search</button>
        </div>
      )}
      {resolvingVariants && <p className="smw-stage-note" role="status">
        Choose the exact recording before creating your message. You can continue with the other details first.
      </p>}

      {requestState.status === 'ready' && (
        <>
          {query.trim().length >= 2 && matchingRecords.length === 0 && !search.warning && (
            <div className="smw-name-empty" role="status">
              <p><strong>Name not found.</strong> Try a name that sounds the same, then change the written spelling in the final step. Santa will still say the recording you choose.</p>
            </div>
          )}
          {matchingRecords.length > 0
            && matchingRecords.length === 10
            && <p className="smw-name-refine">Showing up to 10 matches. Add more letters to refine the list.</p>}
        </>
      )}

      {requestState.status === 'ready' && !search.warning && query.trim().length >= 2 && !selected && !matchingRecords.some(record => santaNameKey(record.name) === santaNameKey(query)) && <WorkshopMissingName key={query.trim().toLowerCase()} name={query} />}

      {selected && (
        <div className="smw-name-status">
          <span aria-live="polite">Selected name: <strong>{santaNameDisplay(selected.name)}{selected.variant ? ` — ${selected.variant}` : ''}</strong></span>
          {previewCache && resolution.record && <WorkshopNamePreview record={resolution.record} cache={previewCache} />}
        </div>
      )}
    </div>
  );
}
