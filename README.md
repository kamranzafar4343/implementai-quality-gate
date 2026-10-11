# iMPLEMENTAi Website Site Quality Gate

A small Node.js crawler that audits public HTML pages for metadata quality, sitemap coverage, stale sitemap entries, and likely orphan pages. It only issues GET requests to public URLs; it does not submit forms or change the target site.

## Requirements

- Node.js 20 or newer
- Internet access to the target public website

## Install and run

```bash
npm install
npm test
npm run audit
```

By default the audit targets `https://implementai.ae` and writes `reports/latest-report.json`.

```bash
# Choose another public website
npm run audit -- --url https://example.com

# Limit crawl size and choose report path
npm run audit -- --max-pages 100 --out reports/example.json

# CI mode: exit 1 if any findings exist; exit 2 for invalid options or audit failure
npm run audit -- --fail-on-issues
```

## Rules

- `missing_meta_description`: absent or empty description.
- `meta_description_too_long`: description exceeds 160 characters.
- `title_too_long`: title exceeds 60 characters. A missing title is not a requested rule and is not currently reported.
- `missing_canonical`: missing or invalid canonical URL.
- `not_in_sitemap`: internal URL discovered through links but absent from the parsed sitemap.
- `invalid_sitemap_url`: a sitemap URL does not return a 2xx HTML page.
- `orphan_candidate`: a discovered or sitemap-listed URL has no inbound internal links among inspected pages. This is a heuristic and requires manual confirmation.

Sitemap discovery reads `robots.txt`, then tries common sitemap paths, and follows sitemap indexes on the same origin. URL normalization removes fragments and trailing slashes and ignores non-HTTP(S) links. Crawl scope is restricted to the starting origin. Sitemap checks and page crawling are bounded by `--max-pages` for page inspection; sitemap discovery is separately capped at 30 sitemap files.

## Exit behaviour

- `0`: audit completed (default, even when findings exist).
- `1`: audit completed with findings when `--fail-on-issues` is supplied.
- `2`: invalid CLI option or audit-level failure.

The report includes a generated timestamp, so report files are not byte-for-byte identical across runs. Finding order and rule evaluation are deterministic for the same observed site state.

## Tests

`npm test` runs Node's built-in test runner against URL normalization, all required finding categories, and non-HTML/failed-page handling. Tests use fixtures created in memory and do not contact the live website.

## Limitations and assumptions

- The crawler does not execute client-side JavaScript; it audits HTML returned by the server.
- Robots directives are reported via status but are not fully interpreted; this is a bounded assessment tool, not a general-purpose search-engine crawler.
- Canonical presence is checked, not whether it points to the preferred URL.
- A sitemap entry is considered live only if it returns a 2xx response with `text/html`; redirects are followed and evaluated at the final response.
- Orphan detection is approximate: a URL can look orphaned if the crawl is capped, a page blocks links, or its inbound link is on an uninspected page.
- URL equivalence is deliberately conservative; query strings are retained because they can represent distinct pages.
- The tool does not submit forms, authenticate, access private systems, or modify website content.
