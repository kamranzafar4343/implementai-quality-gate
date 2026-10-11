# AI Worklog

## How I used AI

- I asked AI to help break the brief into small audit rules.
- I asked for help with the Node.js crawler, sitemap parsing, JSON output, and tests.
- I used AI to review edge cases such as URL normalization, failed pages, and orphan candidates.

## Suggestions I accepted

- Use Node.js with JavaScript and a small number of dependencies.
- Use stable rule names in the JSON report.
- Add a page limit so the crawler cannot run without bounds.
- Return different exit codes for success, findings, and execution errors.

## Suggestions I changed or rejected

- A basic implementation checked only `/sitemap.xml`. I changed it to also read sitemap links from `robots.txt` and follow sitemap indexes.
- I did not treat every HTTP 200 response as a valid page. Sitemap URLs must return HTML.
- I kept orphan results as candidates because crawling cannot prove that a page is truly orphaned.

## What I personally verified

- Ran `npm test` successfully.
- Ran the audit against the public `https://implementai.ae` website.
- Checked that the terminal summary and JSON report contain the same finding counts.
- Checked that `--fail-on-issues` returns a nonzero exit code when findings exist.
- Reviewed the report and documentation before delivery.
