import { useEffect, useRef } from 'react';
import './StudioPortraitViewer.css';

const portrait = '/images/santa-studio-headphones.webp';
const description = 'Santa wearing headphones at a festive message-making microphone';

export default function StudioPortraitViewer() {
  const trigger = useRef(null);
  const dialog = useRef(null);
  const previousOverflow = useRef(null);
  const backdropPress = useRef(false);

  const restoreScroll = () => {
    if (previousOverflow.current === null) return;
    document.body.style.overflow = previousOverflow.current;
    previousOverflow.current = null;
  };
  const closePortrait = () => {
    restoreScroll();
    dialog.current.close();
  };

  useEffect(() => () => restoreScroll(), []);

  return <>
    <button ref={trigger} type="button" className="studio-portrait-trigger"
      aria-label="Enlarge Santa’s studio picture" aria-haspopup="dialog"
      onClick={() => {
        dialog.current.style.setProperty('--studio-portrait-size', `${trigger.current.getBoundingClientRect().width * 3}px`);
        previousOverflow.current = document.body.style.overflow;
        dialog.current.showModal();
        document.body.style.overflow = 'hidden';
      }}>
      <img className="santa-studio-promotion__artwork" src={portrait} alt={description} />
    </button>
    <dialog ref={dialog} className="studio-portrait-dialog" aria-label="Santa’s studio picture"
      onCancel={restoreScroll}
      onClose={() => {
        restoreScroll();
        trigger.current?.focus({ preventScroll: true });
      }}
      onPointerDown={event => { backdropPress.current = event.target === event.currentTarget; }}
      onClick={event => {
        if (backdropPress.current && event.target === event.currentTarget) closePortrait();
        backdropPress.current = false;
      }}>
      <div className="studio-portrait-view">
        <img src={portrait} alt={description} />
        <button type="button" autoFocus className="studio-portrait-close"
          aria-label="Close Santa’s studio picture" onClick={closePortrait}>×</button>
      </div>
    </dialog>
  </>;
}
