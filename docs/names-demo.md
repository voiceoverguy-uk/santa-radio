# Browser-only name-search demonstration

Open `/names` in the existing website Preview. It keeps the plain green page,
centred accessible combobox, two-letter minimum and maximum ten suggestions.
Only this demonstration has the owner's approval to publish its complete
**display-name list**. Homepage/Studio search, audio, access and payments are
unchanged.

## One public download, then no search requests

The page loads a versioned `/names-data/names-<SHA256>.json` once, prepares a
small in-memory prefix index, then searches entirely in the browser. Typing,
choosing, clearing and dismissing results do not contact our server, PostgreSQL
or Stag. There is no debounce delay or persistent browser database. Browser HTTP
caching is intentional; the owner expressly approved the names-only download.

The file is a plain JSON array of 9,773 unique display-name strings, projected
from the existing validated 9,774-recording import. It contains no wrapper,
recording IDs, source filenames, aliases, paths, URLs, tokens, timestamps,
counts, origin information or audio references. Names are rendered using
`textContent`, never as HTML. The old `/api/names-demo` search endpoint now
returns 410 and does not use the shared limiter or database.

## Compression, caching and immutable deployments

`node scripts/prepare-names-demo.mjs` reads only the bundled private snapshot.
It validates and prepares deterministic names-only JSON, Brotli and gzip files,
then atomically publishes a private asset pointer **after** all versions are
ready. Failed preparation retains the old pointer and working assets.

The response negotiates `br`, `gzip` or identity, includes `Vary:
Accept-Encoding`, representation-specific ETags and one-year immutable public
browser/CDN cache headers. Conditional requests support 304. Current sizes:

| Representation | Bytes |
|---|---:|
| JSON | 91,122 |
| Brotli | 22,685 |
| gzip | 28,991 |

Changing names changes the URL's content hash; changing only snapshot metadata
does not. `/names` itself is no-store, so a new page visit obtains the latest
asset reference. Prior hashed files remain available for older open pages.
An already-open page keeps its loaded version until refreshed.

Vercel explicitly packages the generated assets, private pointer and page in
the isolated function. Its runtime does not need the source snapshot, database,
origin configuration, dependencies or writable disks. Two detached runtime-copy
tests verify this with `fetch` forbidden and no environment credentials. The
first public-list download may invoke the function; later requests can use its
public CDN cache and browser cache. No per-keystroke function request exists.

The private snapshot and build manifest remain blocked by web routing, including
Vite raw/`@fs` source-file access. Only the names-only response is public. No
audio/static-source authorization rule is relaxed.

## Manual owner update

After adding recordings, ask the agent to **“update the /names demo snapshot”**
or explicitly run:

```sh
npm run names:demo:update
node --test scripts/names-demo.test.mjs
```

This command performs the existing authorised manual source import, then
prepares the public projections. Acquisition/validation failures preserve the
last valid snapshot. Preparation failure preserves the last published public
asset pointer; fix that preparation error before releasing.

Preparation also runs automatically before development startup and production
builds, **without contacting Stag**. Page visits never import/refresh anything.
The explicit import remains the sole source-fetch operation. In Preview, refresh
`/names` after successful preparation to load the new version. A future Vercel
release must include the updated snapshot and generated assets through the
normal owner-approved code deployment; no deployment is performed here.

## Verification and measured performance

Replit measurements, not Vercel production guarantees:

| Measurement | Desktop | 390px mobile emulation |
|---|---:|---:|
| List fetch through prepared index | 158 ms | 109 ms |
| Response body/decompression/JSON parse | 12.8 ms | 4.0 ms |
| Index preparation | 36.8 ms | 33.2 ms |
| Median local filtering + DOM update | 0.1 ms | 0.1 ms |
| 95th percentile local filtering + DOM update | 0.4 ms | 0.5 ms |

The local-filter measurements use 100 input changes per viewport; they include
the synchronous result DOM update, not the physical display's paint time. A
separate proxied Brotli-download sample took 33 ms. These are different
measurement scopes and should not be confused.

The browser tests switch offline after the single list download, exercise
keyboard and real touch events, repeat 100 searches and assert **zero additional
network requests**. They also cover load/retry failures, malformed data and
initial-load Escape/blur/IME races. Server tests cover names-only content,
compression, cache/version changes, private-file protection, failed updates and
detached instances.

Existing signed-preview/message security tests were rerun with isolated
fixtures, including invalid/expired/wrong-scope tokens and successful authorised
MP3 generation. No real payment or voucher allowance is consumed.

## Separate existing audio exposure

See `docs/security/names-demo-audio-access-audit.md`. A known recording on the
original host remains accessible without credentials. Publishing names may make
filename guessing easier. This demonstration does **not** remediate that
pre-existing exposure, and protected proxy routes do not secure a publicly
reachable original. Owner-authorised origin remediation is separate; no
publication or origin-host change is authorised by this work.
