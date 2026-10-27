import { useEffect, useId, useRef, useState } from 'react';
import './WorkshopChoiceWheel.css';
import { measureWorkshopWheel, sameWheelGeometry, nearestWheelIndex } from '../lib/workshopWheelGeometry.js';

const SCROLL_SETTLE_MS = 220;
const PROGRAMMATIC_GUARD_MS = 140;
const INTERACTION_PREPARE_GUARD_MS = 80;
const noop = () => {};

export default function WorkshopChoiceWheel({
  label,
  options = [],
  value,
  onChange,
  invalid,
  onTick = noop,
  onSoundInteraction = noop,
  showCount = true,
  currentSelectionLabel = '',
}) {
  const choices = options;
  const optionsKey = JSON.stringify(choices.map(option => [option.id, option.label]));
  const selectedIndex = choices.findIndex(option => option.id === value);
  const wheelId = useId();
  const wheelRef = useRef(null);
  const optionRefs = useRef([]);
  const topSpacerRef = useRef(null);
  const bottomSpacerRef = useRef(null);
  const settleTimer = useRef(null);
  const programmaticTimer = useRef(null);
  const interactionTimer = useRef(null);
  const programmaticScroll = useRef(false);
  const userScrolling = useRef(false);
  const touchActive = useRef(false);
  const scrollFrame = useRef(null);
  const geometry = useRef(null);
  const emittedChoice = useRef(null);
  const measuredOptions = useRef(null);
  const finishScrollRef = useRef(null);
  const centerIndexRef = useRef(selectedIndex >= 0 ? selectedIndex : 0);
  const lastSoundedIndex = useRef(selectedIndex);
  const [centerIndex, setCenterIndex] = useState(selectedIndex >= 0 ? selectedIndex : 0);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [hasInteracted, setHasInteracted] = useState(false);

  const setCenter = index => {
    centerIndexRef.current = index;
    setCenterIndex(index);
  };

  const prepareSound = () => {
    if (interactionTimer.current !== null) return;
    onSoundInteraction();
    interactionTimer.current = window.setTimeout(() => {
      interactionTimer.current = null;
    }, INTERACTION_PREPARE_GUARD_MS);
  };

  const tickIndex = index => {
    if (index < 0 || index >= choices.length || lastSoundedIndex.current === index) return;
    lastSoundedIndex.current = index;
    onTick();
  };

  const guardProgrammaticScroll = () => {
    programmaticScroll.current = true;
    window.clearTimeout(programmaticTimer.current);
    programmaticTimer.current = window.setTimeout(() => {
      programmaticScroll.current = false;
    }, PROGRAMMATIC_GUARD_MS);
  };

  const updateSpacers = () => {
    const next = measureWorkshopWheel(wheelRef.current, optionRefs.current.slice(0, choices.length), topSpacerRef.current, bottomSpacerRef.current);
    const changed = !sameWheelGeometry(geometry.current, next);
    geometry.current = next;
    return changed;
  };

  const scrollOptionToCenter = index => {
    const wheel = wheelRef.current;
    const option = optionRefs.current[index];
    if (!wheel || !option) return;
    const wheelRect = wheel.getBoundingClientRect();
    const optionRect = option.getBoundingClientRect();
    const top = wheel.scrollTop + optionRect.top - wheelRect.top
      - (wheel.clientHeight - optionRect.height) / 2;
    guardProgrammaticScroll();
    userScrolling.current = false;
    window.clearTimeout(settleTimer.current);
    wheel.scrollTo({ top, behavior: 'instant' });
  };

  useEffect(() => {
    const wheel = wheelRef.current;
    if (!wheel) return undefined;
    const align = () => {
      updateSpacers();
      const target = selectedIndex >= 0 ? selectedIndex : centerIndexRef.current;
      setCenter(target);
      setActiveIndex(selectedIndex);
      lastSoundedIndex.current = selectedIndex;
      if (target >= 0) scrollOptionToCenter(target);
    };
    const ownChoice = emittedChoice.current === value && measuredOptions.current === optionsKey;
    measuredOptions.current = optionsKey;
    if (ownChoice) updateSpacers();
    else align();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      const changed = updateSpacers();
      if (changed && !userScrolling.current && !touchActive.current) align();
    });
    observer.observe(wheel);
    optionRefs.current.forEach(option => option && observer.observe(option));
    return () => observer.disconnect();
  }, [optionsKey, selectedIndex]);

  useEffect(() => () => {
    if (scrollFrame.current !== null) window.cancelAnimationFrame(scrollFrame.current);
    window.clearTimeout(settleTimer.current);
    window.clearTimeout(programmaticTimer.current);
    window.clearTimeout(interactionTimer.current);
  }, []);

  useEffect(() => {
    const wheel = wheelRef.current;
    const finish = () => finishScrollRef.current?.();
    wheel?.addEventListener('scrollend', finish);
    return () => wheel?.removeEventListener('scrollend', finish);
  }, []);

  const getNearestOption = () => {
    return nearestWheelIndex(geometry.current, wheelRef.current?.scrollTop || 0);
  };

  const chooseIndex = (index, explicitSound = false) => {
    if (index < 0 || index >= choices.length) return;
    if (explicitSound) tickIndex(index);
    setCenter(index);
    setActiveIndex(index);
    setHasInteracted(true);
    emittedChoice.current = choices[index].id;
    onChange(choices[index].id);
  };

  const beginUserScroll = () => {
    prepareSound();
    window.clearTimeout(settleTimer.current);
    window.clearTimeout(programmaticTimer.current);
    programmaticScroll.current = false;
    userScrolling.current = true;
    setHasInteracted(true);
  };

  const processScroll = () => {
    const nearest = getNearestOption();
    if (nearest < 0) return;
    const previousCenter = centerIndexRef.current;
    const movedByUser = !programmaticScroll.current && userScrolling.current;
    if (movedByUser && nearest !== previousCenter) {
      tickIndex(nearest);
    }
    setCenter(nearest);
    if (!movedByUser) return;
    setActiveIndex(nearest);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(finishScroll, SCROLL_SETTLE_MS);
  };

  const handleScroll = () => {
    if (scrollFrame.current !== null) return;
    scrollFrame.current = window.requestAnimationFrame(() => {
      scrollFrame.current = null;
      processScroll();
    });
  };
  const finishScroll = () => {
    if (touchActive.current || !userScrolling.current || programmaticScroll.current) return;
    if (scrollFrame.current !== null) {
      window.cancelAnimationFrame(scrollFrame.current);
      scrollFrame.current = null;
      processScroll();
    }
    window.clearTimeout(settleTimer.current);
    userScrolling.current = false;
    chooseIndex(getNearestOption());
  };
  finishScrollRef.current = finishScroll;
  const endTouch = () => {
    touchActive.current = false;
    window.clearTimeout(settleTimer.current);
    if (userScrolling.current) settleTimer.current = window.setTimeout(finishScroll, SCROLL_SETTLE_MS);
  };

  const moveActiveOption = index => {
    if (!choices.length) return;
    const boundedIndex = Math.min(choices.length - 1, Math.max(0, index));
    chooseIndex(boundedIndex, true);
    scrollOptionToCenter(boundedIndex);
  };

  const handleKeyDown = event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      prepareSound();
      moveActiveOption((activeIndex >= 0 ? activeIndex : -1) + 1);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      prepareSound();
      moveActiveOption((activeIndex >= 0 ? activeIndex : -1) - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      prepareSound();
      moveActiveOption(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      prepareSound();
      moveActiveOption(choices.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      prepareSound();
      chooseIndex(activeIndex >= 0 ? activeIndex : centerIndex, true);
      if (centerIndex >= 0) scrollOptionToCenter(centerIndex);
    }
  };

  return (
    <section className="smw-choice-wheel-field">
      <div className="smw-choice-wheel-heading smw-wheel-accessible-text">
        <span className="smw-choice-wheel-label" id={`${wheelId}-label`}>{label}</span>
        {showCount && <span className="smw-choice-wheel-count" aria-hidden="true">
          {choices.length ? `${choices.length} choices` : 'No choices'}
        </span>}
      </div>
      <p className="smw-choice-wheel-hint smw-wheel-accessible-text" id={`${wheelId}-hint`}>
        Scroll or use the arrow keys to choose. You can also tap an option.
      </p>
      <div className={`smw-choice-wheel-frame${invalid ? ' is-invalid' : ''}`}>
        <span className="smw-choice-wheel-fade smw-choice-wheel-fade-top" aria-hidden="true" />
        <div
          ref={wheelRef}
          id={wheelId}
          className="smw-choice-wheel-scroll"
          role="listbox"
          aria-labelledby={`${wheelId}-label`}
          aria-describedby={`${wheelId}-hint${invalid ? ' smw-validation' : ''}`}
          aria-invalid={!!invalid}
          aria-activedescendant={activeIndex >= 0 ? `${wheelId}-option-${activeIndex}` : undefined}
          tabIndex={0}
          onScroll={handleScroll}
          onWheel={beginUserScroll}
          onPointerDown={beginUserScroll}
          onTouchStart={() => { touchActive.current = true; beginUserScroll(); }}
          onTouchEnd={endTouch}
          onTouchCancel={endTouch}
          onKeyDown={handleKeyDown}
        >
          <div ref={topSpacerRef} className="smw-choice-wheel-spacer" aria-hidden="true" />
          {choices.map((option, index) => (
            <div
              ref={node => { optionRefs.current[index] = node; }}
              id={`${wheelId}-option-${index}`}
              className={`smw-choice-wheel-option${centerIndex === index && (hasInteracted || selectedIndex >= 0) ? ' is-centered' : ''}${selectedIndex === index ? ' is-selected' : ''}`}
              key={`${String(option.id)}-${index}`}
              role="option"
              aria-selected={selectedIndex === index}
              onClick={() => {
                prepareSound();
                window.clearTimeout(settleTimer.current);
                userScrolling.current = false;
                chooseIndex(index, true);
                scrollOptionToCenter(index);
                wheelRef.current?.focus();
              }}
            >
              <span>{option.label}</span>
            </div>
          ))}
          <div ref={bottomSpacerRef} className="smw-choice-wheel-spacer" aria-hidden="true" />
        </div>
        <span className="smw-choice-wheel-fade smw-choice-wheel-fade-bottom" aria-hidden="true" />
      </div>
      <p className="smw-choice-wheel-status" aria-live="polite" aria-atomic="true">
        {selectedIndex >= 0
          ? `Selected: ${choices[selectedIndex].label}`
          : currentSelectionLabel ? `Selected: ${currentSelectionLabel}`
            : hasInteracted ? 'Choose an option to continue.' : 'No option selected yet.'}
      </p>
    </section>
  );
}
