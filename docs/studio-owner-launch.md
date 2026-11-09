# Private Studio launch checks

No existing production secret needs to leave Vercel. No action below enables
public sales, changes a price, makes a payment, or grants access without payment.

## Deploy and authenticate

Use Replit **Sync Changes**, then verify Vercel's READY deployment serving
`www.santaradio.co.uk` contains these changes.

Existing approved Clerk staff sign-in remains supported. Its owner is the
existing verified administrator account; no new users or permissions are added.
The private launch panel is beneath the existing voucher usage/storage checks.

If production staff authentication is not configured, add one new **Sensitive**
Vercel **Production** variable named `STUDIO_OWNER_TOKEN`. Generate at least
32 random bytes as base64url (43 characters or longer, maximum 200) using a
trusted password manager. Retain it privately. Do not put it in source, URLs,
chat, screenshots or console commands. Never replace CRON_SECRET or
STUDIO_RETURN_SECRET. The new variable must be included in a new deployment.
Revoke the owner token after launch by removing it and deploying again.

The token works only on:
`/api/santa-workshop-usage?diagnostic=live-launch`

It cannot authorize normal Studio, vouchers, usage reports or public checkout.

## Token-only invocation

On `https://www.santaradio.co.uk`, use the browser's developer console.
This helper prompts separately for the token, keeps it only in the running
request's memory, never logs it and never stores it in browser storage.

```js
async function checkStudioOwner(action) {
  if (location.origin !== 'https://www.santaradio.co.uk') {
    throw new Error('Open the canonical Santa Radio website first.');
  }
  let token = prompt('Private Studio owner token (never paste into chat)');
  if (!token) return;
  try {
    const response = await fetch(
      '/api/santa-workshop-usage?diagnostic=live-launch',
      {
        method: action ? 'POST' : 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer studio-owner.${token}`,
          ...(action ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(action ? { body: JSON.stringify({ action }) } : {}),
      },
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Owner check failed');
    if (action === 'canary') {
      if (result.pending) {
        location.assign('/bespoke-personalised-message-from-santa?checkout=return');
      } else {
        const url = new URL(result.url);
        if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com'
          || url.username || url.password) throw new Error('Unexpected checkout');
        location.assign(url.href);
      }
      return;
    }
    console.log(result); // Fixed booleans only, never credentials.
  } finally {
    token = '';
  }
}
```

1. `await checkStudioOwner()` runs read-only schema/permission, Stripe,
   webhook-registration and renderer-prerequisite checks inside production.
   It also reports actual stored delivery/worker health and retry approval.
2. `await checkStudioOwner('simulator')` calls the deployed retry worker using
   its existing cron credential. Only Resend's simulator address is used.
   The worker locks/checks the outbox and refuses any pending customer mail.
   It records health only after Resend accepts the simulator request.
   It never drains the outbox and never writes webhook health.
3. Repeat the checks. After successful simulator/worker evidence, the owner
   may set `STUDIO_EMAIL_RETRY_APPROVED=true` in Vercel and deploy that setting.
   Keep `STUDIO_LIVE_SALES_ENABLED=false` and delivery approval unset.
   This starts normal retry processing; recheck the outbox before approving it.
4. Recheck readiness. Once every check except initial webhook delivery passes,
   `await checkStudioOwner('canary')` opens the pinned **real £6.50 checkout**.
   Only the owner submits payment. Cancel or stop before payment if only
   inspecting checkout. There is no automatic payment or free access.
5. The canary uses one stable server-derived claim: repeated requests reuse the
   same open/completed checkout instead of creating more purchases. An expired,
   unpaid session may be replaced. Payment goes through normal validation,
   entitlement, email outbox and exactly-two-creation enforcement.
6. After the owner pays, recheck for genuine signed webhook delivery. A redirect
   alone is not proof. No old customer event is replayed and no health is faked.

## Limits and public launch

The renderer probe verifies packaged files, executable availability, catalogue,
names and allowance storage—not a completed MP3 or its audio quality.
The worker simulator proves authenticated execution, not that every future
scheduled invocation will succeed. Check that its health remains fresh.

Public sales remain protected by the existing environment approvals, database
sales switch and full readiness checks. This endpoint has no enable-sales
action. Only approve public sales separately after genuine delivery evidence
and the owner confirms the complete creation/download path.
