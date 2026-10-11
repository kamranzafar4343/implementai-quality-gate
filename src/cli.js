#!/usr/bin/env node
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { runAudit } from './audit.js';

function arg(name, fallback) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; }
const baseUrl = arg('--url', 'https://implementai.ae');
const out = resolve(arg('--out', 'reports/latest-report.json'));
const maxPages = Number(arg('--max-pages', '250'));
const failOnIssues = process.argv.includes('--fail-on-issues');
if (!Number.isInteger(maxPages) || maxPages < 1) { console.error('--max-pages must be a positive integer'); process.exit(2); }
try {
  const report = await runAudit({ baseUrl, maxPages });
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nSite Quality Gate — ${report.target}`);
  console.log(`Pages inspected: ${report.crawl.pagesInspected}${report.crawl.maxPagesReached ? ' (page limit reached)' : ''}`);
  console.log(`Sitemap URLs: ${report.crawl.sitemapUrlCount} | Internal URLs discovered: ${report.crawl.discoveredInternalUrlCount}`);
  console.log('\nFindings:');
  for (const [rule, count] of Object.entries(report.summary)) console.log(`  ${rule.padEnd(28)} ${count}`);
  console.log(`\nJSON report: ${out}`);
  console.log(`Total findings: ${report.issues.length}`);
  if (failOnIssues && report.issues.length) process.exitCode = 1;
} catch (error) {
  console.error(`Audit failed: ${error.message}`);
  process.exitCode = 2;
}
