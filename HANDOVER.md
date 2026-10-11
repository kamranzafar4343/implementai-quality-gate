# Handover

## What I built

- A small Node.js command-line tool for auditing public websites.
- It audits `https://implementai.ae` by default.
- It produces a readable terminal summary, a JSON report, and deterministic exit codes for CI.

## Checks included

- Missing meta descriptions.
- Meta descriptions over 160 characters.
- Page titles over 60 characters.
- Missing or invalid canonical URLs.
- Internal pages missing from the sitemap.
- Sitemap URLs that do not return a live HTML page.
- Possible orphan pages with no inbound internal links.

## Technical approach

- Node.js 20 with built-in `fetch`.
- Cheerio parses HTML pages.
- `fast-xml-parser` parses XML sitemaps.
- The crawler follows same-origin links and uses a configurable page limit.
- URLs are normalized by removing fragments and trailing slashes.

## Assumptions

- Only publicly accessible pages are audited.
- The tool checks server-rendered HTML and does not execute JavaScript.
- A valid sitemap page must return a 2xx response with an HTML content type.
- Orphan results are candidates and require manual confirmation.
- The tool does not submit forms, authenticate, or modify the target website.

## Testing and report

- Automated tests are included in `test/audit.test.js`.
- Run tests with `npm test`.
- The example live report is stored in `reports/implementai-live-report.json`.

## Delivery commands

```bash
npm install
npm run audit -- --out reports/implementai-live-report.json
npm test
```

For CI quality-gate behavior:

```bash
npm run audit -- --fail-on-issues
```

## Production next steps

If this became a production quality gate, I would add:

- A GUI interface to show the issues and to generate pdf report of issues.
- GitHub Actions to run the tests and audit automatically.
- A configured page limit, timeout, retry policy, and rate limit.
- A baseline report so CI reports only new issues.
- More integration tests using a local fixture website.
- Full `robots.txt` support and optional JavaScript rendering.
- Alerts or pull-request comments when new issues are found.

## Improvements with more time

- Add a local HTTP fixture server for full crawl and sitemap integration tests.
- Respect `robots.txt` disallow and crawl-delay rules more fully.
- Add retries, rate limiting, and optional JavaScript rendering.
- Validate whether canonical URLs point to the preferred page.
- Add a GitHub Actions workflow for automated CI checks.
