# AI Worklog

This log describes AI assistance used while preparing the initial implementation. The developer should review it, add their own observations, and only claim tests they personally ran.

## What AI helped with
- Turning the brief into a small set of crawler stages and explicit finding IDs.
- Drafting the Node.js CLI, metadata checks, sitemap parsing, JSON schema shape, documentation, and initial unit tests.
- Identifying URL normalization, same-origin boundaries, crawl limits, and the heuristic nature of orphan detection as edge cases.

## Suggestions accepted
- Use Node's built-in `fetch` and test runner, with small parsing dependencies rather than a large framework.
- Keep findings machine-readable with stable rule IDs and a terminal summary.
- Use a configurable page cap and distinguish audit findings from audit execution failures.

## Suggestions changed or rejected
- A naive implementation that simply probes `/sitemap.xml` would miss sitemaps declared in `robots.txt` and sitemap indexes, so discovery checks both.
- Treating every sitemap URL with HTTP 200 as healthy is too weak: this implementation also requires an HTML content type for page URLs.
- Orphan detection is not definitive; reports call these `orphan_candidate` and explain the limitation.

## Verification to complete before delivery
- Run `npm install` and `npm test` on the delivery machine.
- Run `npm run audit -- --out reports/implementai-live-report.json` with network access.
- Inspect a sample of the JSON findings against the actual pages in a browser.
- Record any additional bugs or incorrect suggestions discovered during personal review here.
