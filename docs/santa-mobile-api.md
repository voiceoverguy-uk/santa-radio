# Native Santa Radio API contract

`/api/santa-mobile?action=...` is separate from every website endpoint.
Requests must have no browser Origin, Sec-Fetch-Site or Cookie headers. There is
no CORS wildcard and no cookie authentication. Except session creation, requests
need `Authorization: Bearer <server-generated native credential>`.
POST bodies are short JSON, limited by the existing name service reader.
All responses are private/no-store. Error JSON has `error` and may carry a
`Retry-After` response header. Do not log credentials, names or adult contact data.

| Action / method | Body | Response |
| --- | --- | --- |
| session POST | `{}` | 201 `{token,customerId,expiresAt}`; IDs cannot be chosen by caller |
| status GET | none | `{freeStatus:{authorized,availableAt},entitlement:{verified,permanent,credits},purchaseError?}` |
| signup POST | `FIRSTNAME,LASTNAME,EMAIL,email_address_check:""` | Existing adult provider signup success/error. Server captures grant privately, returns no website cookie |
| names POST | `{query,studio:boolean}` | `{records:[{id,name,variant?,token}],warning?}`; no locations or preview origins |
| free POST | `{name:<id>,selectionToken:<token>,outro:1 or 2}` | Existing protected free MP3 flow, including two-hour server allowance |
| catalogue GET | none | `{categories,regionalGroups}` containing IDs, labels and optional destination kinds only |
| studio POST | Existing seven Studio choices, optional region | Temporary `audio/mpeg` response; requires `X-Message-Request-Id` UUID |

`status` may return HTTP 200 with `entitlement.verified=false` during a provider
outage so free access can still be checked. This is **not** paid access.
Studio catalogue/search/create always independently verify purchases server-side.
No purchase or transaction IDs supplied by the client are accepted as authority.

Studio choices are `{name,age,activity,achievement,treat,place,talent,region?}`.
Name is its opaque recording **ID**, not the free-message capability.
Other categories are opaque choice IDs. Talent is either `{skip:true}` or
`{category:"sports"|"funny",id}`. The existing renderer resolves these privately,
including exact name variant and parent/region relationships.

The server uses the existing handler factories in-process after authenticating a
native session. It adapts origin/cookie headers only on that trusted internal
request, never changes the website's guards, and never exposes an arbitrary
proxy operation. `/api/santa-studio-message` still requires its original website
access and same-origin rules. The native generation ledger stores usage hashes,
not audio, adult emails, child names, choice payloads or a product catalogue.

Consumable reservations have a 125-second lease and the existing renderer's
110-second limit. Unique request and purchase keys enforce idempotency across
instances and RevenueCat customer transfers. Failed attempts are released.
Completed purchase usage is retained to prevent replay; expiring that ledger
would re-enable already-spent purchases. Permanent use still obeys the existing
abuse/concurrency limits.
