# Handover

## What was built
A small Node.js command-line crawler and JSON report for the requested metadata, sitemap, broken sitemap URL, and orphan-candidate checks.

## Technical approach
The tool uses Node's built-in `fetch`, Cheerio for HTML parsing, and fast-xml-parser for sitemap XML. It starts at the requested origin, follows same-origin links within a configurable page cap, discovers sitemap files from `robots.txt` and common paths, and evaluates normalized URLs. Findings are represented as stable rule IDs in JSON and summarized in the terminal.

## Assumptions
- The target is publicly accessible without authentication.
- The assessment concerns server-returned HTML and public XML sitemaps.
- 160 characters is the maximum accepted meta description and 60 characters the maximum accepted title, as specified in the brief.
- A sitemap URL is valid when its final response is a 2xx HTML page.

## Edge cases considered
Fragments and trailing slashes are normalized; mailto/non-HTTP links are ignored; external links are excluded; sitemap indexes are followed; failed and non-HTML pages do not receive metadata findings; crawling is bounded; orphan results are explicitly labelled candidates.

## Improvements with more time
Honor robots.txt disallow/crawl-delay rules fully; add retries and rate limiting; parse sitemap namespaces and compressed sitemaps more comprehensively; validate canonical targets and robots noindex; support JavaScript-rendered sites optionally; add CI workflow and baseline/diff mode; add fixtures using local HTTP server responses.

## Live report status
The live report must be generated from a machine with network access using `npm run audit`. The development environment used to prepare this repository could not resolve `implementai.ae`, so no live crawl result has been fabricated. Generate and commit `reports/implementai-live-report.json` from a network-enabled environment before delivery.
