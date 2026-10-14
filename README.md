# Website Site Quality Gate

A small Node.js tool that checks the public iMPLEMENTAi website for common SEO and website quality issues.

For complete setup, operation, CI, and report review instructions, see [MANUAL.md](MANUAL.md).

Quick start for the reviewed iMPLEMENTAi configuration:

```bash
npm ci
npm test
npm run audit:site
```

## Requirements

- Node.js 20.18.1 or newer
- Internet access

## Install

From the project folder, run:

```bash
npm ci
```

## Run the audit

Run the default audit:

```bash
npm run audit
```

This audits `https://implementai.ae`, prints a summary in the terminal, and saves the report to:

```text
reports/latest-report.json
```

To save the report with a different name:

```bash
npm run audit -- --out reports/implementai-live-report.json
```

To audit another public website:

```bash
npm run audit -- --url https://example.com
```

To limit the number of inspected pages:

```bash
npm run audit -- --max-pages 100
```

To set the overall audit deadline (default 120,000 ms):

```bash
npm run audit -- --deadline-ms 30000
```

For recurring public runs, add a delay between requests (for example, 250 ms):

```bash
npm run audit -- --delay-ms 250
```

The crawler honors `robots.txt` `User-agent`, `Allow`, and `Disallow` rules for `SiteQualityGate` and `*`, including `*` and `$` path patterns. Excluded in-scope pages make the audit incomplete. `--delay-ms` defaults to 0 for local and manual checks; set it for recurring public runs.

For a known internal link that intentionally redirects off-site, allow its destination host explicitly:

```bash
npm run audit -- --allow-external-redirect-host calendar.app.google
```

The external destination is never fetched. The redirect is recorded as an outbound boundary and excluded from sitemap page comparisons. Unlisted external redirects still make the audit incomplete. Same-origin redirect aliases are reconciled for sitemap and orphan comparisons; query strings and trailing slashes remain distinct unless an observed redirect connects them.

## Checks performed

The tool reports:

- Missing meta descriptions.
- Meta descriptions longer than 160 characters.
- Page titles longer than 60 characters.
- Missing or invalid canonical URLs.
- Internal pages found through links but missing from the sitemap.
- Sitemap URLs that do not return a live HTML page.
- Possible orphan pages with no inbound internal links.

## Run the tests

```bash
npm test
```

The tests use controlled local HTTP and CLI fixtures and do not contact the live website. CI runs the suite twice on Node 20.18.1 and 22 after `npm ci`.

## CI exit codes

For normal use, findings do not cause a failure:

```bash
npm run audit
```

For CI, use:

```bash
npm run audit -- --fail-on-issues
```

Exit codes:

- `0` — complete audit with no enforced findings.
- `1` — complete audit with findings and `--fail-on-issues`.
- `2` — invalid options or an incomplete/failed audit.

## Project files

The JSON `health` section distinguishes `clean`, `findings`, and `incomplete`, and lists errors and skipped URLs. Exit code `2` means invalid options or an incomplete audit; a missing sitemap, exhausted deadline, or truncated crawl never passes. `--timeout-ms` sets the per-request limit and `--deadline-ms` limits the whole audit. Responses are capped at 2 MiB. The terminal and JSON report show requested, fetched, evaluated, skipped, and remaining page counts.

URL identity uses the full HTTP(S) URL without its fragment. Query strings and trailing slashes remain distinct unless an observed same-origin redirect connects them. Redirects are followed only within the exact origin (same scheme, host, and port), for at most five hops. Each page records its requested `url` and `finalUrl`; same-origin redirect aliases are reconciled for sitemap and orphan comparisons. Canonical URLs do not merge inventory entries. Relative links resolve against `finalUrl`. Unlisted external redirects make the audit incomplete.

- `src/audit.js` — crawler and audit rules.
- `src/cli.js` — command-line interface and exit behavior.
- `test/audit.test.js` — automated tests.
- `reports/implementai-live-report.json` — example live report.
- `HANDOVER.md` — short project handover.
- `AI_WORKLOG.md` — record of AI assistance and verification.

## Limitations

See `SITEONE_EVALUATION.md` for the controlled SiteOne Crawler comparison and remaining adoption work.

- The tool checks server-rendered HTML and does not run JavaScript.
- Orphan findings are candidates and should be checked manually.
- Crawling is limited by `--max-pages`; a truncated crawl exits incomplete.
- Unlisted redirects to another origin are rejected; allowlisted destinations are recorded but never fetched.
- A separate manual GitHub Actions workflow runs the live audit and uploads its JSON report.
- The tool only reads public pages and does not submit forms or change website content.
