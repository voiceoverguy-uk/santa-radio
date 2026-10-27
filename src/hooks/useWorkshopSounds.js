import { useCallback, useEffect, useRef, useState } from 'react';
import { createWorkshopSounds } from '../lib/workshopSounds.js';

export default function useWorkshopSounds() {
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState('');
  const enabledRef = useRef(true);
  const controller = useRef(null);
  const getController = useCallback(() => {
    if (!controller.current) controller.current = createWorkshopSounds({ onStatus: setStatus });
    return controller.current;
  }, []);
  const prepare = useCallback(() => {
    if (enabledRef.current) getController().prepare();
  }, [getController]);
  const playTick = useCallback(() => {
    if (enabledRef.current) getController().playTick();
  }, [getController]);
  const playNext = useCallback(() => {
    if (enabledRef.current) getController().playNext();
  }, [getController]);
  const toggleEnabled = useCallback(() => {
    enabledRef.current = !enabledRef.current;
    setEnabled(enabledRef.current);
    getController().setEnabled(enabledRef.current);
  }, [getController]);
  useEffect(() => () => {
    controller.current?.dispose();
    controller.current = null;
  }, []);
  return { enabled, toggleEnabled, prepare, playTick, playNext, status };
}
