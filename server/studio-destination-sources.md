# Private destination editorial source notes

Checked 2 November 2026. This is an editorial note, not a public catalogue,
recording list or geography lookup service. No source text is copied.

All route incidents are explicitly imaginary, fictional or pretend tabletop
rehearsals. They are not claimed flights, gifts, local customs or observations
about a recipient's home. All ages can read the destination passages. They
replace, rather than supplement, the former shared route anecdote.

## Checked landmark anchors

- England / London: Encyclopaedia Britannica, London entry,
  https://www.britannica.com/place/London — London is in England. Only that
  location is used; no assertion that the recipient lives in London.
- Scotland / Edinburgh Castle: Historic Environment Scotland,
  https://www.edinburghcastle.scot/ — castle described as in the heart of
  Scotland. Models, postcards and paper flags are fictional.
- Wales / Conwy Castle: Cadw,
  https://cadw.gov.wales/visit/places-to-visit/castell-conwy — official Welsh
  historic environment service's castle description and Conwy address.
- Northern Ireland / Giant's Causeway: National Trust,
  https://www.nationaltrust.org.uk/visit/northern-ireland/giants-causeway —
  Northern Ireland location and hexagonal basalt columns. No folklore is
  asserted as fact, and Ireland is never substituted for Northern Ireland.
- United States / Statue of Liberty: US National Park Service,
  https://www.nps.gov/stli/planyourvisit/directions.htm and
  https://www.nps.gov/stli/learn/historyculture/index.htm — monument, crown and
  torch imagery; all mitten, paperweight and model incidents are imaginary.
- Germany / Brandenburg Gate: Berlin's official visitor service,
  https://www.visitberlin.de/en/brandenburg-gate — landmark in Berlin, Germany.
- France / Eiffel Tower: official monument operator SETE,
  https://www.toureiffel.paris/en/the-monument — Eiffel Tower, Paris, France.
- Canada / CN Tower: official tower operator,
  https://www.cntower.ca/ — Canadian landmark, Toronto. No measurements,
  weather, regional customs or recipient location are asserted.

Each of the eight priority selections has eight separately written route
incidents. Repeated landmarks provide an accurate anchor, not a claim of eight
different geographical facts. No UK-wide choice has been invented.

## Other destinations and regional readiness

Other current real destinations each have their own curated fictional
tabletop rehearsal. They assert no cultural or geographical details requiring
external substantiation. In particular, the ambiguous Puffin Island name does
not acquire an invented location, and politically sensitive labels do not
acquire invented borders or nationality claims.

Newly indexed labels get the neutral named-place response and editorial flag,
not a generated incident. Known state and county names are not countries merely
because recordings are uploaded to a folder called countries. The state/county
classification list is not a location resolver: ambiguous labels still get no
invented facts. Regional writing is now separately curated for explicit
parent/region pairs; see the regional source and review notes below.

## Regional source and review notes

Regional location anchors were desk-checked on 4 November 2026 using the
linked geographical/landmark articles, with primary-source corroboration for
the representative selections. Source prose is not copied into the letters.
Every incident is an invented tabletop model, sketch or rehearsal, not a claim
that Santa visited a real attraction or that an operator endorses Santa Radio.
The recognisable geographical name is the factual anchor; paper boats, models,
elf mistakes, hats and biscuits are fictional. No recipient's address, visits,
weather or local traditions are inferred.

The private regional source checker records the exact source URL and a short
location-evidence excerpt for every canonical entry. Disambiguated articles
are required for Box Hill (Surrey), Chimney Rock (Nebraska), Glacier National
Park (US), Craters of the Moon (Idaho), and the Alamo Mission (Texas).
Leicester is in the ceremonial county of Leicestershire; this is not a claim
that the city belongs to the county council's administrative area. The
catalogue also mixes historic counties, council areas and cities in Scotland
and Wales; the writing preserves those choices without reclassifying them.
Mugdock Castle is not used for East Dunbartonshire: the Kirkintilloch canal is
the local anchor instead. Shared/border landmarks are not claimed exclusive.
For Bridgend, Coity Castle is used, not Ogmore Castle (which is in the Vale of
Glamorgan despite being near Bridgend). The Welsh Government visitor service
confirms Coity's Bridgend location:
https://www.visitwales.com/attraction/castle/castell-coety-cadw-535061 .

Additional checked primary sources:

- Florida / Magic Kingdom and EPCOT: Disney's own park pages,
  https://disneyworld.disney.go.com/destinations/magic-kingdom/ and
  https://disneyworld.disney.go.com/destinations/epcot/ — park names and
  Florida resort context only. No visit, access, partnership or ticket claim.
- West Yorkshire / Saltaire: Leeds City Council's visitor service,
  https://www.visitleeds.co.uk/a-guide-to-west-yorkshires-cultural-highlights/
  — Saltaire near Bradford and its mill/textile setting. The oversized scarf
  and flat-capped paper Santa are fictional, not asserted local customs.
- Idaho / Craters of the Moon: US National Park Service,
  https://www.nps.gov/crmo/index.htm — Idaho, an Earth destination, not the Moon.
- Leicestershire / National Space Centre: the centre's own directions,
  https://www.spacecentre.co.uk/plan-explore/how-to-find-us/ — Leicester.
  The similarly named encyclopaedia page is a disambiguation, not location
  evidence. The script uses this operator page rather than accepting that page.
- Wales / regional relationships: Welsh Government's visitor service,
  https://www.visitwales.com/destinations — national and regional distinctions.
- Scotland / regional relationships: national visitor organisation,
  https://www.visitscotland.com/places-to-go — Scottish cities, mainland and
  island regions; no inference that every county has an available recording.

To reproduce the full private source table and inspect every available
regional alternative:

1. `node scripts/check-studio-regional-sources.mjs`
2. `node scripts/audit-studio-regional-letters.mjs --snapshot`

Reports are in `.local/studio-letter-editorial/`, excluded from the public
build. The snapshot option also retains the owner-inspection report beside
these server-only notes, never as a public asset or catalogue endpoint.
Fetch failures, absent parents, held/excluded source records and
unknown editorial labels are reported explicitly. A text match is a source
checking aid, not a substitute for inspecting its context. The prose library
contains two separately written incidents per canonical region, reviewed for
concise British English, child-friendly humour, no alcohol/pub jokes, no
recipient assumptions, and no invented tradition. Aliases share those two
incidents rather than being falsely counted as new writing.

No public endpoint exports the regional library. The existing access-gated
catalogue supplies choices without regional passages; its selected-context
request validates both trusted parent and region IDs and returns only that
selection's two alternatives. Unknown/unreviewed regions remain neutral and
flagged. Country-only, fantasy and space prose is unchanged.
