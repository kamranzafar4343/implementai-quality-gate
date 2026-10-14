# Easy guide: Website Quality Gate

The tool checks the iMPLEMENTAi website and saves a JSON report. It only reads the website.

## First time: set it up

Install [Node.js](https://nodejs.org/) **20.18.1 or newer**. Open PowerShell in this project folder and run:

```powershell
npm ci
npm test
```

`npm test` checks the tool against small local test websites. It does not visit the live site. If you need a fresh copy of the project first, run `git clone https://github.com/kamranzafar4343/implementai-quality-gate.git` and then `cd implementai-quality-gate`.

## Every time: check the live site

```powershell
npm run audit:site
```

Wait for the terminal summary. The full report is [reports/latest-report.json](reports/latest-report.json). Open it in a text editor. Look at `health.status` first, then `issues`.

| Result | What it means | What to do |
| --- | --- | --- |
| `clean` | Audit finished; no findings. | Review coverage, then use the result. |
| `findings` | Audit finished; website issues were found. | Read `issues`; fix or review them. |
| `incomplete` | The audit could not inspect everything. | Read `health.errors` and `health.skippedUrls`; rerun after resolving the cause. |

`npm run audit:site` exits **0** for clean, **1** for findings, and **2** for incomplete or invalid input. An exit code of 1 means the tool worked and found website issues. In PowerShell, type `$LASTEXITCODE` immediately after the run to see it.

If you want a report without a failing exit code for findings, use:

```powershell
npm run audit:site:advisory
```

An incomplete audit still exits 2 in advisory mode. The report shows how many pages were requested, fetched, evaluated, skipped, and left uninspected. A clean result needs no health errors or coverage gaps. `orphan_candidate` findings need a human check.

The site has an intentional `/bookings` redirect to Google Calendar. The `audit:site` commands record that as an outbound link and do not visit Google. Other external redirects remain errors. These commands also use a 300-page limit, a five-minute overall deadline, and a 250 ms request delay.

## Use GitHub Actions

There are **two different workflows** in the repository:

1. **Quality gate tests** run automatically whenever code is pushed or a pull request is opened. On GitHub, open **Actions**, choose **Quality gate tests**, open the newest run, and check that both Node 20 and Node 22 jobs are green. This tests the code; it does not visit the live site.
2. **Live site audit** runs when you ask for it. On GitHub, open **Actions → Live site audit → Run workflow**, choose `main`, and click **Run workflow**. Leave **enforce_findings** on for a release decision; turn it off only for an advisory report. Open the finished run and download the **live-site-audit-json** artifact to read the JSON report.

The live site had **181 findings** in the [14 October 2026 verification](VERIFICATION.md). A live run with **enforce_findings** on is expected to be red until those website issues are fixed. Red may also mean an incomplete audit; check `health.status` in the downloaded report to tell which.

## After the report

Fix website content and sitemap problems in the **website project**, then run the audit again. This repository reports problems; it does not edit the website. The seven checks cover description presence and length, title length, canonical presence, linked URLs missing from the sitemap, invalid sitemap URLs, and possible orphan pages.

For a different site or different limits, use `npm run audit -- --url https://example.com --out reports/other-site.json`. [README.md](README.md) lists every option. [VERIFICATION.md](VERIFICATION.md) contains the exact reviewed live command and result. [SITEONE_EVALUATION.md](SITEONE_EVALUATION.md) explains the SiteOne comparison.
