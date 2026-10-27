---
name: Workshop choice controls
description: Owner-required selection controls for Santa’s Message Workshop.
---

Use “It's all about the little details ...” beneath the main Studio heading on every stage, including review.

**Why:** The owner repeated this exact wording after finding the older promotional sentence still beneath the heading.

**How to apply:** Keep this main-heading subtitle consistent across the entire Studio. This instruction is about the line beneath the title, not the individual stage questions or Santa's wording previews.

Keep Studio copy concise rather than adding explanatory sentences around obvious controls.

**Why:** The owner said they are “trying to avoid too many words on the page” when removing the name-search explanation.

**How to apply:** Preserve essential questions, field labels, validation and accessible instructions, but do not restore removed optional guidance without a new request. The source-file review notice must stay absent on every Studio stage, including review. The owner also explicitly removed both final review testing disclaimers despite knowing it is testing mode: keep those notices out rather than reintroducing them for explanation.

Keep the Studio's quiet wheel and Continue sounds, without a visible on/off button.

**Why:** The owner asked to remove the workshop-sounds toggle because they do not consider the feedback irritating enough to need it.

**How to apply:** Preserve deliberate-interaction playback and keep blocked audio non-blocking. Do not restore the toggle or direct visitors to a removed sound control.

Activity, achievement, treat and location wheels also need optional live keyword search. Do not add this extra search to names, ages or the final review.

**Why:** The owner asked for search on those four stages only: “toys” should find “Tidying away toys”, and “football” should find “Playing football”. Their marked desktop positions are beneath Santa’s wording cards.

**How to apply:** Filter the currently loaded hosted catalogue in the browser, not a baked-in duplicate or a server call for every keystroke. Keep original ordering and exact recording identities. Filtering must not silently choose a match or erase an existing choice; clear should restore the full wheel. On phones place search before the wheel so it is easy to reach, keeping the wording below.

For step four on desktop, align the live search field's bottom edge with the main wheel's bottom border, not the selection-status text below it.

**Why:** The owner specifically requested this alignment with a cropped screenshot of the achievement search field sitting above the wheel's bottom edge.

**How to apply:** Keep Santa's helper top-aligned and the search beneath it; retain the search-first stacked layout on phones. Allow enlarged text and selection-status wrapping without losing the border alignment.

Verify wheel content on first desktop entry with the full hosted list, not only small fixtures or a phone page resized to desktop.

**Why:** After an alignment change, the owner saw a blank achievement wheel even though outer-border alignment checks and a small-choice test passed. Counting options in the DOM does not prove that their text is visible inside the clipped scroll frame.

**How to apply:** Check that the scrolling viewport fits its visible frame and that actual option text intersects the frame before any resize or filtering. Cover first/last keyboard selection, search/clear and enlarged text as well as border alignment.

Workshop choice categories should use compact vertical scroll wheels with closely spaced options across every choice stage, except names, which must use live search. Longer text choices need a wider wheel than the age picker.

**Why:** The owner said: “all of them should use a scroller just NOT the names as too many. So they need to be live search.” They later rejected age cards: “I keep mentionaing a carousel style scroll wheel”, with an iOS-style vertical picker example, then asked for “a wider scroller for the counties and achievements etc”.

**How to apply:** Use the compact vertical wheel for age and wider, wrapping vertical wheels for activity, achievement, festive treat and magical place. The owner subsequently requested shorter scrollers and closer options across all pages; retain comfortable tap targets and allow long labels to expand. Keep name selection searchable in the familiar cream autocomplete rather than a scroller. Do not infer a new approved country catalogue from the request for a wider control.

The owner wants the workshop connected to real MP3 generation, not just a visual preview of the Generate and finished-message screens.

**Why:** When offered those two alternatives, the owner selected “Connect real MP3 generation”.

**How to apply:** Treat actual creation from the selected recorded details, playback and MP3 download as the requested direction. Do not substitute a simulated result screen or an unrelated example recording.

Keep the repeated category label, choice total and scroll/arrow-key help above workshop wheels out of the visible layout, while retaining accessible names and instructions.

**Why:** The owner asked to lose those two lines above the picker, showing “Something they do” and “Scroll or use the arrow keys to choose. You can also tap an option.” They repeated this for the destination wheel, including its “120 choices” total.

**How to apply:** Keep stage questions and genuine input labels intact. Simplify wheel presentation without removing the screen-reader label, keyboard support or required-choice feedback.

On desktop, the Santa helper card's visible top edge should align with the left-hand selection control's visible top edge, not a category label or instruction above it.

**Why:** The owner supplied an alignment guide and specifically requested the helper box line up with the main selection box. They repeated this for step one's focused name field.

**How to apply:** Apply this consistently across the name, age, activity, achievement, treat and destination stages, including the focused field's visible gold edge. Keep the existing stacked card below the control on phones.

Keep the final-review spelling controls minimal: use a pencil icon on the right of the certificate-name preview, not a separate spelling button. Do not show filename information.

**Why:** The owner clarified that the certificate is the only reason visitors need to change spelling; the filename information is irrelevant to them. This replaces their earlier request for grouped certificate and filename previews.

**How to apply:** Update the filename automatically in the background when certificate spelling changes, without changing the selected recording. Keep the old spelling button and explanation out. Preserve editor validation, cancel/reset and focus behaviour, readable phone/enlarged-text layouts and the separate optional spelling-suggestion consent.

Let the browser position Studio text fields for its mobile keyboard; do not also raise the panel or scroll focused inputs into place from application code.

**Why:** The owner ultimately pinpointed entering a text box as the wobble trigger, superseding the earlier step-transition diagnosis. Even a once-only focus scroll can compete with Safari's keyboard movement.

**How to apply:** Cover first focus, refocus and every category search on phones/tablets, not only typing after focus has already settled. Retain at least 16px input text, disable smooth root scrolling only inside the touch-sized Studio, and preserve pinch zoom. Desktop panel alignment and explicit step changes are separate behaviours.

Keep enough height for a short mobile Studio step to fill the usable stable viewport, even while keeping the page otherwise compact.

**Why:** Removing all spare height from short steps lets the browser clamp scrolling at the document bottom; a final-position check alone can miss transition movement. This is a separate safeguard, not confirmation of the owner's reported focus-triggered wobble.

**How to apply:** Do not reintroduce large footer clearance, but preserve the one-screen height floor and stable viewport sizing. Check long-to-short transitions, Back and review editing, and count page-position adjustments rather than only checking the final coordinate. Headless mobile checks do not verify a physical iPhone's keyboard animation.
