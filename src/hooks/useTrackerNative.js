import { useEffect, useState } from 'react';
import { isTrackerNative } from '../lib/trackerNative.js';
export default function useTrackerNative() {
  const [native, setNative] = useState(false);
  useEffect(() => setNative(isTrackerNative(navigator.userAgent)), []);
  return native;
}
