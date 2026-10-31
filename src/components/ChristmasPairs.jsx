import { useEffect, useMemo, useRef } from 'react';
import { Pause, Play, RotateCcw, Star, Volume2, VolumeX } from 'lucide-react';
import useChristmasPairs from './useChristmasPairs.js';
import './ChristmasPairs.css';

const SAMPLE_PICTURES = [
  { id: 'puppy', label: 'Puppy', src: '/images/christmas-pairs/puppy.webp' },
  { id: 'burger', label: 'Burger and chips', src: '/images/christmas-pairs/burger.webp' },
  { id: 'soft-toy', label: 'Blue soft toy', src: '/images/christmas-pairs/soft-toy.webp' },
];

export default function ChristmasPairs() {
  const {
    state,
    best,
    soundEnabled,
    audioUnavailable,
    toggleSound,
    start,
    flip,
    restart,
    togglePause,
    nextLevel,
    newGame,
  } = useChristmasPairs();
  const boardRef = useRef(null);
  const nextRef = useRef(null);
  useEffect(() => {
    if (state.phase === 'preview') boardRef.current?.focus({ preventScroll: true });
    if (state.phase === 'complete') nextRef.current?.focus({ preventScroll: true });
  }, [state.phase]);

  const cards = state.cards || [];
  const totalPairs = cards.length ? cards.length / 2 : state.level === 1 ? 3 : 4;
  const pairsFound = state.matched.length;
  const isStarted = ['loading', 'preview', 'playing', 'complete'].includes(state.phase);
  const isPaused = state.paused;
  const facesVisible = !isPaused && (state.phase === 'preview' || state.phase === 'playing' || state.phase === 'complete');
  const isBusy = state.phase !== 'playing' || isPaused || state.selected.length >= 2;
  const previewSeconds = Math.max(0, Math.ceil((state.remainingMs || 0) / 1000));
  const statusMessage = useMemo(() => {
    if (state.phase === 'complete') return `Level ${state.level} complete. ${pairsFound} pairs found.`;
    if (state.phase === 'preview') return `Level ${state.level}. Remember the pictures.`;
    if (state.phase === 'playing' && pairsFound > 0) return `${pairsFound} of ${totalPairs} pairs found.`;
    if (state.phase === 'playing') return `Level ${state.level} is underway.`;
    if (state.phase === 'error') return state.error || 'The pictures could not be loaded.';
    return '';
  }, [state.phase, state.level, state.error, pairsFound, totalPairs]);

  return (
    <section className="christmas-pairs" id="christmas-pairs" aria-labelledby="christmas-pairs-title">
      <div className="christmas-pairs__decor" aria-hidden="true" />
      <div className="christmas-pairs__inner">
        <div className="christmas-pairs__heading">
          <p className="christmas-pairs__eyebrow">A little game from the workshop</p>
          <div className="christmas-pairs__title-wrap">
            <span className="christmas-pairs__title-star" aria-hidden="true"><Star size={17} fill="currentColor" /></span>
            <h2 id="christmas-pairs-title">Christmas Pairs</h2>
          </div>
          <p className="christmas-pairs__intro">
            Remember the pictures, then find each matching pair.
          </p>
        </div>

        <div className="christmas-pairs__game">
          <div className="christmas-pairs__scoreline" aria-label="Game progress">
            <div className="christmas-pairs__stat">
              <span className="christmas-pairs__stat-label">Level</span>
              <strong>{state.level}</strong>
            </div>
            <div className="christmas-pairs__stat christmas-pairs__stat--center">
              <span className="christmas-pairs__stat-label">Pairs found</span>
              <strong>{pairsFound}<span className="christmas-pairs__score-divider"> / </span>{totalPairs}</strong>
            </div>
            <div className="christmas-pairs__stat christmas-pairs__stat--best">
              <span className="christmas-pairs__stat-label"><Star aria-hidden="true" size={13} /> Best</span>
              <strong>{best}</strong>
            </div>
          </div>

          {state.phase === 'idle' && (
            <div className="christmas-pairs__idle">
              <p className="christmas-pairs__prompt">Take a good look...</p>
              <div className="christmas-pairs__sample" aria-hidden="true">
                {SAMPLE_PICTURES.map((picture, index) => (
                  <div className="christmas-pairs__sample-card" key={picture.id} style={{ '--sample-index': index }}>
                    <img src={picture.src} alt="" loading="lazy" />
                  </div>
                ))}
              </div>
              <p className="christmas-pairs__idle-copy">
                Start with three pairs. Later levels add more cards and shorten your first look.
              </p>
              <div className="christmas-pairs__idle-actions">
                <button className="christmas-pairs__button christmas-pairs__button--ruby" type="button" onClick={start}>
                  <Play size={17} aria-hidden="true" /> Start game
                </button>
                <div className="christmas-pairs__sound-control">
                  <button
                    className="christmas-pairs__button christmas-pairs__button--sound"
                    type="button"
                    onClick={toggleSound}
                    aria-pressed={soundEnabled}
                    aria-label={soundEnabled ? 'Turn sound off' : 'Turn sound on'}
                  >
                    {soundEnabled ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
                    Sound {soundEnabled ? 'on' : 'off'}
                  </button>
                  {audioUnavailable && <span className="christmas-pairs__audio-note">Sound is unavailable on this device.</span>}
                </div>
              </div>
            </div>
          )}

          {state.phase === 'loading' && (
            <div className="christmas-pairs__message" role="status">
              <span className="christmas-pairs__loading-mark" aria-hidden="true" />
              <strong>Setting the picture cards...</strong>
              <span>Getting the workshop ready.</span>
            </div>
          )}

          {state.phase === 'error' && (
            <div className="christmas-pairs__message christmas-pairs__message--error" role="alert">
              <strong>Those pictures did not load.</strong>
              <span>{state.error || 'Please try again in a moment.'}</span>
              <button className="christmas-pairs__button christmas-pairs__button--gold" type="button" onClick={restart}>
                <RotateCcw size={16} aria-hidden="true" /> Retry images
              </button>
            </div>
          )}

          {cards.length > 0 && !['loading', 'error'].includes(state.phase) && (
            <>
              <div className="christmas-pairs__board-shell">
                <p className="christmas-pairs__board-note">
                  {state.phase === 'preview' && !isPaused
                    ? <>Remember the pictures <span aria-label={`${previewSeconds} seconds remaining`}>· {previewSeconds}s</span></>
                    : state.phase === 'complete'
                      ? 'A perfect match'
                      : state.phase === 'playing'
                        ? 'Find the matching pictures'
                        : 'Christmas picture cards'}
                </p>
                <div ref={boardRef} tabIndex={-1} aria-label="Picture cards"
                  className={`christmas-pairs__grid ${cards.length === 6 ? 'christmas-pairs__grid--three' : 'christmas-pairs__grid--four'}${cards.length >= 20 ? ' christmas-pairs__grid--large' : ''}`}>
                  {cards.map((card, index) => {
                    const matched = state.matched.includes(card.picture.id);
                    const selected = state.selected.includes(card.id);
                    const shown = facesVisible && (state.phase === 'preview' || selected || matched);
                    const cardLabel = shown
                      ? `Card ${index + 1}: ${card.picture.label}${matched ? ', matched' : ''}`
                      : `Card ${index + 1}, face down`;
                    return (
                      <button
                        className={`christmas-pairs__card${shown ? ' is-shown' : ''}${matched && facesVisible ? ' is-matched' : ''}`}
                        type="button"
                        key={card.id}
                        aria-label={cardLabel}
                        aria-disabled={matched || selected || isBusy}
                        onClick={() => flip(card.id)}
                      >
                        <span className="christmas-pairs__card-back" aria-hidden="true">
                          <span className="christmas-pairs__back-star"><Star size={18} aria-hidden="true" /></span>
                          <span className="christmas-pairs__back-mark">SR</span>
                        </span>
                        <span className="christmas-pairs__card-front" aria-hidden={!shown}>
                          <img src={card.picture.src} alt="" />
                        </span>
                      </button>
                    );
                  })}
                </div>
                {isPaused && (
                  <div className="christmas-pairs__pause-cover">
                    <span className="christmas-pairs__pause-rule" />
                    <strong>Game paused</strong>
                    <span>Your pictures are tucked away.</span>
                    <button className="christmas-pairs__button christmas-pairs__button--gold" type="button" onClick={togglePause}>
                      <Play size={16} aria-hidden="true" /> Resume
                    </button>
                  </div>
                )}
              </div>
              {state.phase === 'playing' && (
                <div className="christmas-pairs__detail-row" aria-label="Round details">
                  <span>{state.moves} {state.moves === 1 ? 'move' : 'moves'}</span>
                  <span className="christmas-pairs__detail-dot" aria-hidden="true" />
                  <span>{totalPairs - pairsFound} {totalPairs - pairsFound === 1 ? 'pair' : 'pairs'} to find</span>
                </div>
              )}
            </>
          )}

          {state.phase === 'complete' && (
            <div className="christmas-pairs__complete">
              <p>Lovely remembering. You found all {totalPairs} pairs in {state.moves} {state.moves === 1 ? 'move' : 'moves'}.</p>
              <div className="christmas-pairs__complete-actions">
                <button ref={nextRef} className="christmas-pairs__button christmas-pairs__button--gold" type="button" onClick={nextLevel}>
                  <Star size={16} aria-hidden="true" /> Next level
                </button>
                <button className="christmas-pairs__button christmas-pairs__button--quiet" type="button" onClick={newGame}>
                  Play again
                </button>
              </div>
            </div>
          )}

          <div className="christmas-pairs__controls">
            {isStarted && state.phase !== 'loading' && state.phase !== 'error' && (
              <>
                <button className="christmas-pairs__button christmas-pairs__button--outline" type="button" onClick={restart}>
                  <RotateCcw size={16} aria-hidden="true" /> Restart level
                </button>
                {state.phase !== 'complete' && (
                  <button
                    className="christmas-pairs__button christmas-pairs__button--gold"
                    type="button"
                    onClick={togglePause}
                    aria-pressed={isPaused}
                  >
                    {isPaused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                )}
              </>
            )}
            {state.phase !== 'idle' && <div className="christmas-pairs__sound-control">
              <button
                className="christmas-pairs__button christmas-pairs__button--sound"
                type="button"
                onClick={toggleSound}
                aria-pressed={soundEnabled}
                aria-label={soundEnabled ? 'Turn sound off' : 'Turn sound on'}
              >
                {soundEnabled ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
                Sound {soundEnabled ? 'on' : 'off'}
              </button>
              {audioUnavailable && <span className="christmas-pairs__audio-note">Sound is unavailable on this device.</span>}
            </div>}
          </div>
        </div>
        <p className="christmas-pairs__live" aria-live="polite" aria-atomic="true">{statusMessage}</p>
      </div>
    </section>
  );
}
