import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import './WorkshopAgeCarousel.css';
import { measureWorkshopWheel, sameWheelGeometry, nearestWheelIndex } from '../lib/workshopWheelGeometry.js';

const SCROLL_SETTLE_MS = 220;
const INTERACTION_PREPARE_GUARD_MS = 80;
const noop = () => {};

export default function WorkshopAgeCarousel({
  options = [],
  value,
  onChange,
  invalid,
  onTick = noop,
  onSoundInteraction = noop,
}) {
  const wheelId = useId();
  const wheelRef = useRef(null);
  const optionRefs = useRef([]);
  const topSpacerRef = useRef(null);
  const bottomSpacerRef = useRef(null);
  const settleTimer = useRef(null);
  const guardTimer = useRef(null);
  const interactionTimer = useRef(null);
  const programmaticScroll = useRef(false);
  const userScrolling = useRef(false);
  const touchActive = useRef(false);
  const scrollFrame = useRef(null);
  const geometry = useRef(null);
  const emittedChoice = useRef(null);
  const measuredOptions = useRef(null);
  const finishScrollRef = useRef(null);
  const selectedIndex = options.findIndex(option => option.id === value);
  const optionsKey = JSON.stringify(options.map(option => [option.id, option.label]));
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
    if (index < 0 || index >= options.length || lastSoundedIndex.current === index) return;
    lastSoundedIndex.current = index;
    onTick();
  };

  const updateSpacers = () => {
    const next = measureWorkshopWheel(wheelRef.current, optionRefs.current.slice(0, options.length), topSpacerRef.current, bottomSpacerRef.current);
    const changed = !sameWheelGeometry(geometry.current, next);
    geometry.current = next;
    return changed;
  };

  const scrollToIndex = index => {
    const wheel = wheelRef.current;
    const option = optionRefs.current[index];
    if (!wheel || !option) return;
    const wheelRect = wheel.getBoundingClientRect();
    const optionRect = option.getBoundingClientRect();
    const top = wheel.scrollTop + optionRect.top - wheelRect.top
      - (wheel.clientHeight - optionRect.height) / 2;
    programmaticScroll.current = true;
    userScrolling.current = false;
    window.clearTimeout(guardTimer.current);
    window.clearTimeout(settleTimer.current);
    guardTimer.current = window.setTimeout(() => { programmaticScroll.current = false; }, 140);
    wheel.scrollTo({ top, behavior: 'instant' });
  };

  useLayoutEffect(() => {
    const wheel = wheelRef.current;
    if (!wheel) return undefined;
    const align = () => {
      updateSpacers();
      const target = selectedIndex >= 0
        ? selectedIndex
        : Math.min(Math.max(centerIndexRef.current, 0), Math.max(options.length - 1, 0));
      setCenter(target);
      setActiveIndex(selectedIndex);
      lastSoundedIndex.current = selectedIndex;
      if (options.length) scrollToIndex(target);
    };
    // A value emitted by this wheel is already at its native scroll position.
    // Recentring it on the parent render would interrupt momentum.
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
    window.clearTimeout(guardTimer.current);
    window.clearTimeout(interactionTimer.current);
  }, []);

  useEffect(() => {
    const wheel = wheelRef.current;
    const finish = () => finishScrollRef.current?.();
    wheel?.addEventListener('scrollend', finish);
    return () => wheel?.removeEventListener('scrollend', finish);
  }, []);

  const getNearestIndex = () => {
    return nearestWheelIndex(geometry.current, wheelRef.current?.scrollTop || 0);
  };

  const chooseIndex = (index, explicitSound = false) => {
    if (index < 0 || index >= options.length) return;
    if (explicitSound) tickIndex(index);
    setCenter(index);
    setActiveIndex(index);
    setHasInteracted(true);
    emittedChoice.current = options[index].id;
    onChange(options[index].id);
  };

  const beginScroll = () => {
    prepareSound();
    window.clearTimeout(settleTimer.current);
    window.clearTimeout(guardTimer.current);
    programmaticScroll.current = false;
    userScrolling.current = true;
    setHasInteracted(true);
  };

  const processScroll = () => {
    const nearest = getNearestIndex();
    if (nearest < 0) return;
    const previousCenter = centerIndexRef.current;
    const movedByUser = !programmaticScroll.current && userScrolling.current;
    if (movedByUser && nearest !== previousCenter) {
      // One audible tick per visible centre change, never a burst of queued
      // play/pause calls for rows skipped between animation frames.
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
    chooseIndex(getNearestIndex());
  };
  finishScrollRef.current = finishScroll;
  const endTouch = () => {
    touchActive.current = false;
    window.clearTimeout(settleTimer.current);
    if (userScrolling.current) settleTimer.current = window.setTimeout(finishScroll, SCROLL_SETTLE_MS);
  };

  const handleKeyDown = event => {
    let next;
    const current = activeIndex >= 0 ? activeIndex : -1;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = current + 1;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = current - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = options.length - 1;
    else if (event.key === 'PageDown') next = current + 5;
    else if (event.key === 'PageUp') next = current - 5;
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      prepareSound();
      const currentIndex = activeIndex >= 0 ? activeIndex : centerIndex;
      chooseIndex(currentIndex, true);
      scrollToIndex(currentIndex);
      return;
    } else return;

    event.preventDefault();
    prepareSound();
    const bounded = Math.min(options.length - 1, Math.max(0, next));
    chooseIndex(bounded, true);
    scrollToIndex(bounded);
  };

  return (
    <section className="smw-age-carousel">
      <div className="smw-age-carousel-heading smw-wheel-accessible-text">
        <span className="smw-age-carousel-label" id={`${wheelId}-label`}>Their age</span>
      </div>
      <p className="smw-age-carousel-instruction smw-wheel-accessible-text" id={`${wheelId}-hint`}>
        Scroll or use the arrow keys to choose an age.
      </p>
      <div className={`smw-age-wheel${invalid ? ' is-invalid' : ''}`}>
        <span className="smw-age-wheel-edge smw-age-wheel-edge-top" aria-hidden="true" />
        <div
          ref={wheelRef}
          id={wheelId}
          className="smw-age-wheel-scroll"
          role="listbox"
          aria-labelledby={`${wheelId}-label`}
          aria-describedby={`${wheelId}-hint${invalid ? ' smw-validation' : ''}`}
          aria-invalid={!!invalid}
          aria-activedescendant={activeIndex >= 0 ? `${wheelId}-option-${activeIndex}` : undefined}
          tabIndex={0}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onWheel={beginScroll}
          onPointerDown={beginScroll}
          onTouchStart={() => { touchActive.current = true; beginScroll(); }}
          onTouchEnd={endTouch}
          onTouchCancel={endTouch}
        >
          <div ref={topSpacerRef} className="smw-age-wheel-spacer" aria-hidden="true" />
          {options.map((option, index) => (
            <div
              ref={node => { optionRefs.current[index] = node; }}
              id={`${wheelId}-option-${index}`}
              className={`smw-age-wheel-option${centerIndex === index && (hasInteracted || selectedIndex >= 0) ? ' is-centered' : ''}${selectedIndex === index ? ' is-selected' : ''}`}
              key={`${String(option.id)}-${index}`}
              role="option"
              aria-selected={selectedIndex === index}
              onClick={() => {
                prepareSound();
                window.clearTimeout(settleTimer.current);
                userScrolling.current = false;
                chooseIndex(index, true);
                scrollToIndex(index);
                wheelRef.current?.focus();
              }}
            >
              <span>{option.label}</span>
            </div>
          ))}
          <div ref={bottomSpacerRef} className="smw-age-wheel-spacer" aria-hidden="true" />
        </div>
        <span className="smw-age-wheel-edge smw-age-wheel-edge-bottom" aria-hidden="true" />
      </div>
      <p className="smw-age-wheel-status" aria-live="polite" aria-atomic="true">
        {selectedIndex >= 0
          ? `Selected: ${options[selectedIndex].label}`
          : hasInteracted ? 'Choose an age to continue.' : 'No age selected yet.'}
      </p>
    </section>
  );
}
