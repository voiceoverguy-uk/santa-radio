# Automatic recorded-name updates

The owner requested automatic updates on 11 November 2026, superseding the earlier manual-only demo policy.

All browser name pickers and /names load /names-data/latest.json once per page. Filtering remains local; typing does not fetch the catalogue again. Reload the page to check for additions.

The feed projects only validated, deduplicated display names from the existing private catalogue. The shared catalogue refreshes on demand after four minutes, with a fenced database lease and one-minute retry backoff. The CDN caches the public projection for one minute; browsers revalidate. Normal additions appear within about five minutes on reload, without rebuilding or deploying. Existing daily snapshots are treated as due after four minutes on the first feed request.

An upstream failure keeps the existing database snapshot. If the catalogue cannot be loaded at all, the feed serves the validated bundled list and retries after a short CDN cache. Audio IDs, files, URLs and tokens are never included. Recording selection continues through the protected exact-search endpoint.

The 11 November import added Annagills and Raymie: 9,775 recordings, 9,774 distinct display names. The owner reported three new uploads; the third is Hannah George, which is absent from the live source index as of this import. It will appear automatically once the source lists its recording.
