import { useCallback, useEffect, useRef, useState } from 'react';

export const ELF_REACTION_ART = {
  'thumbs-up': '/images/head-elf-office-panel-thumbs-up.webp',
  pleased: '/images/head-elf-office-panel-pleased.webp',
  curious: '/images/head-elf-office-panel-curious.webp',
  shocked: '/images/head-elf-office-panel-shocked.webp',
  'extra-shocked': '/images/head-elf-office-panel-extra-shocked.webp',
};

export default function useElfReaction() {
  const [reaction, setReaction] = useState('regular');
  const [readyArt, setReadyArt] = useState({});
  const [pleased, setPleased] = useState(false);
  const timer = useRef(null);
  const generation = useRef(0);
  const images = useRef({});
  const clear = useCallback(() => {
    generation.current++;
    clearTimeout(timer.current);
    timer.current = null;
    setReaction('regular');
    setPleased(false);
  }, []);
  useEffect(() => {
    let active = true;
    // Decode expressions ahead of the first question. Never replace the
    // regular frame with missing or half-loaded artwork.
    for (const [kind, src] of Object.entries(ELF_REACTION_ART)) {
      const image = new Image();
      image.src = src;
      images.current[kind] = image.decode().then(() => true, () => false);
      images.current[kind].then(ready => {
        if (active) setReadyArt(current => ({ ...current, [kind]: ready }));
      });
    }
    return () => {
      active = false;
      generation.current++;
      clearTimeout(timer.current);
    };
  }, []);
  const reactToAnswer = (answer, noCount) => {
    const token = ++generation.current;
    clearTimeout(timer.current);
    const kind = answer === 'yes' ? 'thumbs-up' : noCount > 5 ? 'extra-shocked' : 'shocked';
    images.current[kind]?.then(ready => {
      if (generation.current !== token) return;
      if (!ready) { setReaction('regular'); return; }
      setReaction(kind);
      timer.current = setTimeout(() => {
        if (generation.current === token) setReaction('regular');
      }, 2000);
    });
  };
  const noteAnswers = answers => {
    let consecutive = 0;
    for (const answer of answers) {
      consecutive = answer === 'yes' ? consecutive + 1 : 0;
      // Once earned, keep this baseline until the check is reset. Re-answering
      // the same question cannot manufacture a four-question streak.
      if (consecutive >= 4) { setPleased(true); break; }
    }
  };
  return {
    reaction: reaction === 'regular' && pleased && readyArt.pleased ? 'pleased' : reaction,
    curiousReady: readyArt.curious, noteAnswers, reactToAnswer, clear,
  };
}
