import { useSyncExternalStore } from 'react';

// The last two generated greetings stay in this open tab, including SPA
// navigation. Neither audio nor names are written to persistent browser storage.
let messages = [];
const listeners = new Set();
const getSnapshot = () => messages;
const subscribe = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export default function useSantaMessageHistory() {
  const history = useSyncExternalStore(subscribe, getSnapshot);
  const remember = (recording, blob) => {
    const url = URL.createObjectURL(blob);
    const next = [...messages, {
      ...recording, key: url, url,
    }].slice(-2);
    for (const previous of messages) {
      if (!next.includes(previous)) URL.revokeObjectURL(previous.url);
    }
    messages = next;
    listeners.forEach(listener => listener());
  };
  return { messages: history, remember };
}
