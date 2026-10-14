# Website Quality Gate: operator manual

This tool audits public, server-rendered HTML pages for the seven checks in the assignment. It prints a terminal summary and writes a JSON report. It only reads the target site. Use this manual for local runs and GitHub Actions.

## 1. Install and test

Requirements: Node.js **20.18.1 or newer**, npm, and internet access for a public crawl. From the repository root:

```powershell
git clone https://github.com/kamranzafar4343/implementai-quality-gate.git
cd implementai-quality-gate
npm ci
npm test
```

If you already have the repository, update it with `git pull` before `npm ci`. `npm ci` installs the versions in `package-lock.json`. The tests use local HTTP fixtures and do **not** crawl the public site. A passing test suite means the code passed those fixtures; it is not evidence that the current website is clean.

## 2. Run the website audit

For the iMPLEMENTAi site, run this reviewed configuration from the repository root:

```powershell
npm run audit -- --url https://implementai.ae/ --max-pages 300 --timeout-ms 12000 --deadline-ms 300000 --delay-ms 250 --allow-external-redirect-host calendar.app.google --fail-on-issues --out reports/latest-report.json
```

The `/bookings` URL intentionally redirects to `calendar.app.google`. The explicit host allowance records it as an outbound boundary; the external page is never fetched. Remove or change that allowance if the site behavior changes. Other external redirects make the audit incomplete. Do not use the allowance for a host you intend to audit as part of this site.

`--fail-on-issues` makes a completed audit with findings exit `1`. Omit it for an advisory run that still writes and prints findings. The default `npm run audit` targets iMPLEMENTAi but does **not** include the site-specific redirect allowance, so it currently reports an incomplete audit. For another site, use `--url` and review its own redirect policy.

The report is written to the path after `--out`; parent directories are created. In PowerShell, inspect the last exit code with `$LASTEXITCODE`. In Bash, use `echo $?` immediately after the command.

## 3. Options

| Option | Default | Meaning |
| --- | --- | --- |
| `--url` | `https://implementai.ae` | Start URL; HTTP or HTTPS. |
| `--out` | `reports/latest-report.json` | JSON output path. |
| `--max-pages` | `250` | Shared cap for link and sitemap page inspection. Skipped pages make the audit incomplete. |
| `--timeout-ms` | `12000` | Per-request limit, including response-body reading. |
| `--deadline-ms` | `120000` | Limit for the whole audit. Expiry makes it incomplete. |
| `--delay-ms` | `0` | Minimum pacing between requests. Use a conservative value for recurring public crawls. |
| `--allow-external-redirect-host` | none | Comma-separated exact destination hostnames that are recorded but never fetched. |
| `--fail-on-issues` | off | Exit `1` when a complete audit has findings. |

Unknown, duplicate, missing, or invalid options exit `2` before the audit. The response-body size cap is 2 MiB. The crawler follows at most five redirects, and only within the exact origin unless an external destination host is explicitly allowed as a boundary.

## 4. Interpret the result

| `health.status` | Meaning | Exit code |
| --- | --- | --- |
| `clean` | Completed with no findings. | `0` |
| `findings` | Completed, with rule findings. | `1` with `--fail-on-issues`; otherwise `0`. |
| `incomplete` | Coverage or operational problem: read `health.errors`, `health.skippedUrls`, and the crawl counts. | `2` |

Exit `2` also covers invalid options or an error before a report can be written. Never treat an incomplete run as a pass, even if it also lists findings. A completed audit with findings means the **tool worked** and the **website needs review**.

The JSON report contains:

- `configuration` and `urlPolicy`: the limits and scope used for this run.
- `health`: clean/findings/incomplete, errors, skipped URLs, sitemap discovery status, and deadline status.
- `crawl`: requested, fetched, evaluated, skipped, and remaining page counts, plus sitemap counts.
- `summary`: finding count for each of the seven rules.
- `issues`: individual findings with rule, URL, and message.
- `pages`: requested `url`, `finalUrl`, HTTP status, content type, metadata, and internal links.

Review `health` first. Confirm no errors or skipped/remaining URLs, then inspect `issues`. `orphan_candidate` requires manual confirmation. Query strings and trailing slashes are distinct unless a same-origin redirect connects them. Canonical URLs are reported but do not silently merge inventory entries.

The seven rules are: missing description, description over 160 characters, title over 60 characters, missing/invalid canonical, linked URL absent from the sitemap, invalid sitemap URL, and orphan candidate.

## 5. GitHub Actions: code tests

[Quality gate tests](.github/workflows/quality-gate.yml) runs on every push and pull request. It performs `npm ci` and runs `npm test` twice on Node **20.18.1** and **22**. To check it: open the repository on GitHub → **Actions** → **Quality gate tests** → select the newest run → inspect both Node jobs. A green run means the fixtures passed on that commit. The workflow does not crawl the live website.

If you want merges to require these checks, configure a branch protection rule for `main` in GitHub repository **Settings → Branches**, then select **Require status checks to pass before merging** and the two test jobs. This requires repository administration rights. The workflow passing does not automatically enable branch protection.

## 6. GitHub Actions: live quality gate

[Live site audit](.github/workflows/live-site-audit.yml) is manual so pushes do not repeatedly crawl the public site. Open **Actions → Live site audit → Run workflow**, choose `main`, set **enforce_findings** (`true` for a release gate, `false` for advisory reporting), and run it. The job uses the reviewed command from section 2 and uploads `reports/ci-live-report.json` as the **live-site-audit-json** artifact, including when the audit exits with findings or incomplete coverage. Open the run and download that artifact to inspect `health` and `issues`.

The live site had 181 findings in the 14 October 2026 snapshot, so an enforced run is expected to fail until those findings are fixed or the site's policy is deliberately changed. An advisory run can succeed with findings, but still exits `2` if the audit is incomplete. Review the JSON on every run; a green workflow alone is not the full audit evidence.

## 7. What was verified, and what to do next

[VERIFICATION.md](VERIFICATION.md) records the live command and result. [The dated JSON snapshot](reports/live-verification-2026-10-14.json) had 146 requested/fetched URLs, 145 evaluated HTML pages, no coverage gaps, and 181 findings. The code test workflow passed on Node 20.18.1 and 22 at commit `bdb598d`. These are dated results; rerun before making a release decision.

For each new run: install with `npm ci`, run `npm test`, run the audit with the reviewed options, confirm `health` and coverage, then triage findings by URL and rule. Fix site content or sitemap entries in the website project, rerun, and compare the new report. This repository reports issues; it does not modify the website.

The tool does not execute JavaScript, authenticate, submit forms, or infer pages that neither links nor sitemaps expose. It respects the implemented `robots.txt` `User-agent`, `Allow`, and `Disallow` rules and marks relevant exclusions incomplete. [SITEONE_EVALUATION.md](SITEONE_EVALUATION.md) explains why SiteOne was evaluated but not adopted as the assignment gate.
