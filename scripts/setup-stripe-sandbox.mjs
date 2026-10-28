import { initializeSandboxStripe } from '../server/stripeClient.js';
import { prepareSandboxPurchaseStore } from '../server/santa-studio-purchase.js';

try {
  const result = await initializeSandboxStripe();
  if (result.livemode !== false) throw new Error('STRIPE_SANDBOX_REQUIRED');
  await prepareSandboxPurchaseStore();
  console.log(JSON.stringify({ initialized: true, ...result }));
} catch (error) {
  console.error(/^STRIPE_[A-Z0-9_]+$/.test(error.message) ? error.message : 'STRIPE_SANDBOX_INITIALIZATION_FAILED');
  process.exitCode = 1;
}
