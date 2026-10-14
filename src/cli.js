#!/usr/bin/env node
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { runAudit } from './audit.js';

function parseArgs(args) {
  const options = { baseUrl: 'https://implementai.ae', out: 'reports/latest-report.json', maxPages: 250, timeoutMs: 12000, deadlineMs: 120000, delayMs: 0, allowedExternalRedirectHosts: [], failOnIssues: false };
  const names = { '--url': 'baseUrl', '--out': 'out', '--max-pages': 'maxPages', '--timeout-ms': 'timeoutMs', '--deadline-ms': 'deadlineMs', '--delay-ms': 'delayMs', '--allow-external-redirect-host': 'allowedExternalRedirectHosts' };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (seen.has(token)) throw new Error(`Duplicate option: ${token}`);
    seen.add(token);
    if (token === '--fail-on-issues') { options.failOnIssues = true; continue; }
    if (!(token in names)) throw new Error(`Unknown option: ${token}`);
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
    if (token === '--allow-external-redirect-host') options.allowedExternalRedirectHosts = value.split(',').map(host => host.trim());
    else options[names[token]] = value;
  }
  for (const key of ['maxPages', 'timeoutMs', 'deadlineMs', 'delayMs']) {
    const value = Number(options[key]);
    if (!Number.isSafeInteger(value) || value < (key === 'delayMs' ? 0 : 1)) throw new Error(`${key} must be ${key === 'delayMs' ? 'a nonnegative' : 'a positive'} integer`);
    options[key] = value;
  }
  return options;
}
try {
  const { baseUrl, out: outputPath, maxPages, timeoutMs, deadlineMs, delayMs, allowedExternalRedirectHosts, failOnIssues } = parseArgs(process.argv.slice(2));
  const out = resolve(outputPath);
  const report = await runAudit({ baseUrl, maxPages, timeoutMs, deadlineMs, delayMs, allowedExternalRedirectHosts });
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nSite Quality Gate — ${report.target}`);
  console.log(`Pages inspected: ${report.crawl.pagesInspected}${report.crawl.maxPagesReached ? ' (page limit reached)' : ''}`);
  console.log(`Sitemap URLs: ${report.crawl.sitemapUrlCount} | Internal URLs discovered: ${report.crawl.discoveredInternalUrlCount}`);
  console.log('\nFindings:');
  for (const [rule, count] of Object.entries(report.summary)) console.log(`  ${rule.padEnd(28)} ${count}`);
  console.log(`\nJSON report: ${out}`);
  console.log(`Total findings: ${report.issues.length}`);
  console.log(`Audit health: ${report.health.status} | Requested: ${report.crawl.pagesRequested} | Fetched: ${report.crawl.pagesFetched} | Evaluated: ${report.crawl.pagesEvaluated} | Skipped: ${report.crawl.pagesSkipped} | Remaining: ${report.crawl.pagesRemaining}`);
  if (report.health.status === 'incomplete') process.exitCode = 2;
  else if (failOnIssues && report.issues.length) process.exitCode = 1;
} catch (error) {
  console.error(`Audit failed: ${error.message}`);
  process.exitCode = 2;
}
