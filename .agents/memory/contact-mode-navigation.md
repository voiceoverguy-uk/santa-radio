---
name: Contact mode navigation
description: Controlled form choices must not be reverted by delayed router navigation.
---
Do not treat a controlled mode update as evidence that the URL changed. Keep URL-change detection separate from the immediate UI selection.

**Why:** React Router navigation can update the address in a transition after the radio's local state changes. An effect depending on both values can restore the old mode before that transition completes, undoing clicks and keyboard choices.

**How to apply:** When synchronising a form mode with query parameters, react to actual address changes, preserve draft fields, and hold the submitted mode while a request is active. Verify real radio clicks, arrow-key navigation and browser history. Cancellation checks must wait for the destination page to render before releasing a held response: an updated address alone does not prove the old form unmounted.

Successful acceptance must remain visible even if browser history changed the address while the request was pending. Consume that deferred address change without replacing the success with a blank form; a subsequent intentional navigation can select a new mode.

**Why:** Hiding a provider-accepted confirmation makes a visitor think nothing was sent and invites a duplicate submission.

**How to apply:** Test both acceptance and rejection after pending history navigation, not only whether the modes stay locked during the request.
