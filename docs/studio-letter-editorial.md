# Contextual Studio letters

## Scope and coverage

The authorised server-side hosted inventory was audited on 2 November 2026:

| Category | Selectable choices |
| --- | ---: |
| Age | 63 |
| Activity | 131 |
| Achievement | 38 |
| Offering | 96 |
| Destination | 120 |
| **Total** | **448** |

This is the actual current non-name inventory, not the deliberately small public
promotional fixture. The audit checks **995 complete letters**, exercising each
choice's response alternatives, choice retention, grammatical guardrails,
editorial flags and a conservative text budget. The private matrix contains
every selected display value, response group, exceptions and editorial status.
It contains no name inventory, recording IDs or source locations.

Two meanings need owner clarification: **Stagecoach** and **T-B-L**.
These are audited unknowns, not silently excluded choices.
They retain their original labels, a neutral reaction and a `needsReview` flag.
The owner-approved **Falkland Islands** display correction keeps the original
recording filename and identity unchanged. The existing two source recordings
excluded from destination choices by the catalogue parser are not selectable
inputs and are separate from these two letter-editorial questions.

## Editorial approach

- Month-labelled ages, young children, older children, teenagers, eighteen and
  older adults have different reactions. Adult believers get affectionate
  humour, not childlike praise or instructions to go to bed.
- Activities and achievements use contextual encouragement, not assumed
  diagnoses, family circumstances, comparisons or shame. The selected labels
  remain quoted, accommodating noun phrases and gerunds without changing the
  Workshop choices. “Extra celebration” is the existing achievement field.
- Ordinary food, drinks, letters, reindeer offerings, practical gifts and
  amusements have separate reactions. Rubbish, smelly socks and coal get comic
  surprise, not edible-treat gratitude.
- Alcohol stays adults-only until flying duties are finished. Rum cake is
  ingredient-qualified. Energy drinks are not promoted to children or reindeer.
  Reindeer offerings are checked by their keeper.
- Real destinations, fantasy and space have distinct route anecdotes.
  Anecdotes are explicitly fictional: there are **no factual claims about local
  customs, weather, geography or the recipient's home**, so no external factual
  cultural references are used.
- Compatible alternatives are selected using page-local random slots, not the
  recipient's name. Spelling edits and presentation controls cannot reshuffle
  the prose. Editing one choice retains the variation of unaffected paragraphs.

The full choice-to-response mapping stays in the server-only editorial index.
The protected catalogue attaches small response-group tags to the existing
records. The browser's curated prose library contains groups and only the
original small public promotional subset of labels. It never fetches a new
public choice inventory or sends runtime AI requests.

There are no new dependencies, recipient storage, regeneration controls,
recording changes, purchase activation, paid PDF generation or delivery changes.

## Verification

- `node --test scripts/studio-letter-responses.test.mjs scripts/studio-selected-letter.test.mjs scripts/workshop-treat-wording.test.mjs scripts/workshop-https-catalogue.test.mjs`
  — **26 passed**.
- `node scripts/audit-studio-letter.mjs`
  — hosted inventory read successfully; **448 choices / 995 complete-letter
  checks**; two explicit semantic unknowns.
- Browser checks: **52 passed** across public gifts, recipient consistency,
  contextual variants and the isolated authorised selected-detail flow.
  Contextual tests cover months, 2, 10, 17, 18 and 50, joke offerings, sensitive
  achievements, food and drink categories, fantasy/space/real destinations,
  long combinations, spelling edits, detail edits, enlargement and resizing.
- Complete A4 geometry and unclipped signature/closing verified without
  reducing the existing canonical 11.6-point text scale.
- `npm run build` passed, including Node SSR and 1,576 pre-rendered pages.
- The private matrix URL was unavailable through the proxied development
  host; the existing protected-catalogue access tests still pass.

Two older checks also fail against the **unchanged pre-edit baseline** and were
not loosened or hidden by changing their assertions:

1. `script ink is complete and clear of certificate artwork at 320px`:
   the tiny Edward certificate ink starts at roughly 0.324–0.328 of the sheet
   rather than the check's strict `> 0.33`. This is unrelated to letter wording.
2. `compact desktop card groups gifts right of voucher controls without a full-size letter stack`:
   the current promotion is 786.22px high against an older `< 750px` expectation.

The public gift suite has 35 passing checks plus these two baseline failures.
The recipient suite has 13 passing checks, contextual suite two, and selected
Workshop flow two. The final passing gift run excluded only the two explicitly
documented baseline failures, after running and reproducing both independently
with the old letter source.

## Bundle impact

Identical Vite client builds were compared, using pre-edit source transforms for
the baseline without modifying the working tree. Across all client JavaScript
chunks the increase is **21,005 bytes minified / 8,277 bytes gzip** (approximately
20.5 KiB / 8.1 KiB). The main app chunk accounts for effectively all of this;
the staff chunk's content-hash reference contributes a negligible gzip difference.
No CSS or package-size change was required.

## Repeat the private audit

Run `node scripts/audit-studio-letter.mjs` in the authorised workspace. It uses
the existing server-side hosted catalogue loader and fails explicitly if that
source is unavailable. It must not substitute a partial fixture.

Outputs:

- `.local/studio-letter-editorial/coverage.md`: private complete matrix.
- `.local/studio-letter-editorial/representative-letters.md`: five complete
  examples with invented recipients, covering infant, young child, older child,
  eighteen and adult language.
- `generated-artifacts/studio-editorial/editorial-samples.html`: self-contained
  owner-facing summary and those five complete examples, **not** paid letter
  fulfilment.

Generated reports are intentionally not committed or deployed. The audit script
recreates them after merging. Bundle measurements in the HTML are explicitly
marked unmeasured if its local measurement file is absent.
