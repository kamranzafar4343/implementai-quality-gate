# Website Site Quality Gate

A small Node.js tool that checks the public iMPLEMENTAi website for common SEO and website quality issues.

## Requirements

- Node.js 20 or newer
- Internet access

## Install

From the project folder, run:

```bash
npm install
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

The tests use controlled sample data and do not contact the live website.

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

- `0` — audit completed successfully with no enforced failure.
- `1` — audit completed and findings were detected with `--fail-on-issues`.
- `2` — invalid options or the audit could not run.

## Project files

- `src/audit.js` — crawler and audit rules.
- `src/cli.js` — command-line interface and exit behavior.
- `test/audit.test.js` — automated tests.
- `reports/implementai-live-report.json` — example live report.
- `HANDOVER.md` — short project handover.
- `AI_WORKLOG.md` — record of AI assistance and verification.

## Limitations

- The tool checks server-rendered HTML and does not run JavaScript.
- Orphan findings are candidates and should be checked manually.
- Crawling is limited by `--max-pages`.
- The tool only reads public pages and does not submit forms or change website content.
