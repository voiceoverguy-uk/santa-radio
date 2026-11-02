# Fuller contextual Studio letters

## Editorial balance

The earlier letter combined longer festive prose with generic praise, universal
age surprise and food-style thanks. The owner's 2 November screenshot showed
the newer contextual reactions, but consecutive form-answer paragraphs left
little room for a story. This composition preserves those contextual meanings
and restores general festive scenes **between** personal details:

1. Greeting and a workshop scene.
2. Age and activity reactions.
3. A reindeer/departure-preparation scene.
4. Achievement, destination and offering reactions.
5. A quieter Christmas-atmosphere scene.
6. Age-appropriate reminder, sign-off, signature, North Pole and postscript.

The three scenes replace the former short opening/farewell and add an
interleaved preparation paragraph; they are not appended as a block. All three
fit the reviewed composition without reactive removal, shrinking or clipping.
The artwork, CSS body scale and full-page popup geometry are unchanged.

## Curated library and tone

There are **120 distinct narrative passages**, each 30–45 words:

| Role | Family-safe | Adult-only |
| --- | ---: | ---: |
| Workshop life | 20 | 20 |
| Reindeer and departure preparations | 20 | 20 |
| Warm Christmas atmosphere | 20 | 20 |

Scenes include toy testing, the post room, wrapping mishaps, tea breaks,
workshop inventions, sleigh maintenance, stable care and quiet snowy evenings.
They are complete authored paragraphs, not synonym templates. Roles do not
reuse the same incident. General scenes concern Santa's fictional workshop,
never invented facts about the recipient or their family.

Family scenes are safe for infants, young children, teenagers and unknown ages:
they contain no babyish recipient address or bedtime instructions. From 18,
all three roles use the adult library's affectionate, slightly wry tone.
The existing distinct eighteenth-birthday age response is retained. Adult scenes
assume no employment, parenthood, alcohol use, relationships or life history.

All existing age/activity/achievement/offering contextual reactions remain.
Infant greetings, sensitive achievements, reindeer offerings, practical items,
letters, rubbish, coal, smelly socks, alcohol and energy drinks remain distinct.
Exact selected values are preserved. Four introductions per selected-detail
category accommodate noun phrases and gerunds; reminders and postscripts also
vary. No gift promises, runtime AI, new services or recipient storage are added.

## Destination writing and confidentiality

Every currently selectable real destination now has dedicated reviewed prose,
not its name inserted before the former shared route anecdote.

There are eight alternatives **for each actual selection** England, Scotland,
Wales and Northern Ireland, plus eight each for United States, Germany,
France and Canada. No generic UK choice has been invented. Ireland has its
own separate writing and is not treated as the UK.

Landmark anchors have private source notes in
`server/studio-destination-sources.md`. All route incidents are explicitly
fictional tabletop rehearsals; no local weather, religious observance, customs
practised by the recipient, exact residence or political borders are inferred.
Other destinations have individually written fictional rehearsal scenes
without new geographical claims. Ambiguous Puffin Island is not assigned a
guessed location.

The full mapping stays in `server/studio-destination-passages.js`, never
imported by browser code. An authorised catalogue record carries only its own
small prose context. The client includes only the original four public
promotional destinations. No public inventory export or name list is added.
Production client build checks confirm private destination sentences are absent.

New states/counties can enter the existing destination catalogue through
indexed WAV/MP3 uploads to its existing folder. Labels and recording IDs remain
unchanged. Known regions are not classified as countries; unknown new places
also are not automatically declared countries. They receive a neutral
named-place sentence and private editorial flag pending bespoke writing.
See `workshop-https-inventory.md` for upload conventions, cache refresh and the
explicit boundary: no separate regional folders or extra questions are
integrated, and no recordings are created or modified by this task.

## Stable page-local variation

Each scene, selected reaction, introduction, reminder and postscript has an
independent page-local variation slot. Spelling edits, resizing, immediate
reveal, enlargement and returning from a choice editor preserve it. Changing
one choice changes only its response paragraph; age-band changes may also
change scene eligibility. Neither names nor choices seed randomness.

The deterministic audit measured **1,000 distinct complete child outputs from
1,000 variations** and **1,000 distinct complete adult outputs from 1,000
variations**, with fixed selections and invented names. These are measured
samples, not theoretical counts or promises of globally unique gifts.

## Current authorised audit

The hosted server-side catalogue was successfully audited on 2 November 2026:

| Category | Selectable choices |
| --- | ---: |
| Age | 63 |
| Activity | 131 |
| Achievement | 38 |
| Offering | 96 |
| Destination | 120 |
| **Total** | **448** |

The private matrix covers **849 complete selected-response checks**, exercising
every current choice and every applicable contextual response alternative.
The count differs from the earlier audit because one dedicated response now
replaces three generic route alternatives for most destinations.
Separate tests exercise all 120 new narratives across eligible age bands.

Only **Stagecoach** and **T-B-L** still need semantic clarification; both retain
neutral reactions and private flags. The catalogue parser's two technical
destination files held out from selection are a separate issue.

Run `node scripts/audit-studio-letter.mjs` in the authorised workspace. It fails
explicitly if the hosted catalogue cannot be read and never substitutes a
public fixture. Outputs are ignored and outside deployment:

- `.local/studio-letter-editorial/coverage.md`: complete private non-name matrix.
- `.local/studio-letter-editorial/metrics.json`: narrative and measured variety totals.
- `.local/studio-letter-editorial/representative-letters.md`: 12 complete letters,
  including identical-selection adult and child pairs, all priority markets,
  infant, eighteen and teenage examples.
- `generated-artifacts/studio-editorial/editorial-samples.html`: self-contained
  editorial review with invented recipients, not paid document fulfilment.
- `generated-artifacts/studio-editorial/geometry.json`: browser-measured bounds.

## Verification

- **44 Node tests passed** across fuller narratives, existing responses,
  selected letters, treat wording, catalogue parsing and Studio audio.
- **16 contextual/recipient browser tests passed**, including every new
  narrative as a possible longest-layout candidate, all authorised current
  non-name choices, seven age bands, priority destinations, regional fallbacks
  and independent variation stability.
- **Eight targeted gift checks passed** for longest selections, writing/rotation,
  public substitutions and full A4 readability with enlarged interface text.
- **Three protected selected-detail browser checks passed** using temporary
  test-only access codes: desktop/mobile spelling and editor returns, plus
  synthetic state/county selection through letter review and message request.
- Longest-combination checks measure actual wrapped candidate paragraph heights,
  not just character counts. Across desktop and 320px phone popups, production
  and fallback fonts, **28 measurements** keep the entire text/closing within
  approximately **82.4% of A4 height**, below the existing 88% artwork boundary.
  Body type remains approximately **11.6pt**; no CSS change was needed.
- `npm run build` passed: client, Node SSR and 1,576 pre-rendered canonical pages.

A broader 53-check public browser batch reached check 45 before its five-minute
shell limit. Its newly stale deterministic-random/postscript assertions were
updated for the expanded slots and then passed in the targeted rerun; the full
recipient suite was separately completed.

Two already documented unrelated gift-suite failures remain and were not
weakened or hidden:

1. `script ink is complete and clear of certificate artwork at 320px`:
   Edward's tiny certificate ink begins at about 0.328 versus the old `> 0.33`
   clearance assertion. Letter typography and certificate styling are unchanged.
2. `compact desktop card groups gifts right of voucher controls without a full-size letter stack`:
   current promotion height is about 763px versus the older `< 750px` assertion.
   The promotion layout was not redesigned by this task.

No unavailable audit access is being substituted with a completeness claim.
Real iPhone/Safari rendering is not claimed by the Chromium checks.
