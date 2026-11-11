import { publishableKeyFromHost } from '@clerk/shared/keys';

// Managed production keys identify the configured Clerk domain, which may differ
// from the website's www hostname. Host inference is only for legacy proxy setup.
export function clerkPublishableKey(host, configuredKey) {
  return configuredKey || publishableKeyFromHost(host);
}
