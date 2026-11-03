import { Redirect } from 'expo-router';

// The app selector needs a distinct preview path; native screens retain their
// original routes and the Expo packager keeps its root manifest URL.
export default function MobilePreviewEntry() {
  return <Redirect href="/" />;
}
