import { useCallback, useEffect, useRef, useState } from 'react';
import useMessageDemos from './useMessageDemos.js';
import { builtInDemos } from '../lib/messageDemoCatalogue.js';

export function nextVideoExample(recent, random = Math.random, examples = builtInDemos.free) {
  if (!examples.length) return {next:null, recent:[]};
  const previous = recent.filter(id => examples.some(example => example.id === id));
  const unused = examples.filter(example => !previous.includes(example.id));
  const choices = unused.length ? unused : examples.filter(example => example.id !== previous.at(-1));
  const pool = choices.length ? choices : examples;
  const next = pool[Math.min(pool.length-1, Math.floor(Math.max(0,random())*pool.length))];
  return {next, recent:[...(unused.length ? previous : []), next.id]};
}

export default function useVideoDemo(group) {
  const demos = useMessageDemos(group);
  const storageKey = group === 'free' ? 'santa-video-example-rotation-v2' : 'santa-video-example-' + group;
  const recent = useRef([]);
  const initialised = useRef(null);
  const [selected, setSelected] = useState(null);
  const choose = useCallback(() => {
    const result = nextVideoExample(recent.current, Math.random, demos);
    recent.current = result.recent;
    setSelected(result.next?.id ?? null);
    try { sessionStorage.setItem(storageKey,JSON.stringify(result.recent)); } catch { /* Storage is optional. */ }
  }, [demos, storageKey]);
  useEffect(() => {
    if (!demos.length || initialised.current === demos) return;
    initialised.current = demos;
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
      recent.current = Array.isArray(saved) ? saved : [];
    } catch { recent.current = []; }
    choose();
  }, [demos, storageKey, choose]);
  return {example:demos.find(demo => demo.id === selected), choose};
}
