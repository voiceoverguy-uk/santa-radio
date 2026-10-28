import { createSandboxApi, prepareFamilyOffer } from '../server/stripe-sandbox.js';

try {
  const api = await createSandboxApi();
  console.log(JSON.stringify(await prepareFamilyOffer(api), null, 2));
} catch (error) {
  // Do not log arbitrary SDK errors, headers, credentials or Stripe responses.
  console.error(/^STRIPE_[A-Z0-9_]+$/.test(error.message) ? error.message : 'STRIPE_SANDBOX_PREPARATION_FAILED');
  process.exitCode = 1;
}
