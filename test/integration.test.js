import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { runAudit } from '../src/audit.js';

async function fixture(handler) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
async function close(server) { await new Promise(resolve => server.close(resolve)); }
function html(base, links = '', metadata = true) {
  return `<html><head>${metadata ? `<title>Good</title><meta name="description" content="Good"><link rel="canonical" href="${base}">` : ''}</head><body>${links}</body></html>`;
}

test('unavailable root is incomplete, not clean', async () => {
  const { server, base } = await fixture((req, res) => { res.writeHead(404); res.end(); });
  try {
    const report = await runAudit({ baseUrl: base, maxPages: 1, timeoutMs: 100 });
    assert.equal(report.health.status, 'incomplete');
    assert.equal(report.crawl.pagesEvaluated, 0);
  } finally { await close(server); }
});

test('complete audit distinguishes clean and findings', async () => {
  let bad = false;
  const { server, base } = await fixture((req, res) => {
    if (req.url === '/robots.txt') { res.end(''); return; }
    if (req.url === '/sitemap.xml') { res.setHeader('content-type', 'application/xml'); res.end(`<urlset><url><loc>${base}/</loc></url></urlset>`); return; }
    if (req.url.endsWith('.xml')) { res.writeHead(404); res.end(); return; }
    res.setHeader('content-type', 'text/html'); res.end(html(base, '', !bad));
  });
  try {
    assert.equal((await runAudit({ baseUrl: base, maxPages: 2, timeoutMs: 1000 })).health.status, 'clean');
    bad = true;
    const report = await runAudit({ baseUrl: base, maxPages: 2, timeoutMs: 1000 });
    assert.equal(report.health.status, 'findings');
    assert.equal(report.summary.missing_meta_description, 1);
  } finally { await close(server); }
});

test('sitemap pages share cap, preserve skipped URLs, and discover their links', async () => {
  let htmlRequests = 0;
  const { server, base } = await fixture((req, res) => {
    if (req.url === '/sitemap.xml') { res.setHeader('content-type', 'application/xml'); res.end(`<urlset><url><loc>http://127.0.0.1:${server.address().port}/a-map</loc></url><url><loc>http://127.0.0.1:${server.address().port}/z-extra</loc></url></urlset>`); return; }
    if (req.url === '/robots.txt' || req.url.endsWith('.xml')) { res.writeHead(404); res.end(); return; }
    htmlRequests++;
    res.setHeader('content-type', 'text/html');
    res.end(html(base, req.url === '/a-map' ? '<a href="/linked">linked</a>' : ''));
  });
  try {
    const report = await runAudit({ baseUrl: base, maxPages: 2, timeoutMs: 1000 });
    assert.equal(htmlRequests, 2);
    assert.equal(report.crawl.pagesRequested, 4);
    assert.equal(report.crawl.pagesFetched, 2);
    assert.equal(report.crawl.pagesEvaluated, 2);
    assert.equal(report.crawl.pagesSkipped, 2);
    assert.equal(report.crawl.pagesRemaining, 2);
    assert.equal(report.health.status, 'incomplete');
    assert.ok(report.issues.some(issue => issue.rule === 'not_in_sitemap' && issue.url === `${base}/linked`));
  } finally { await close(server); }
});

test('overall deadline stops sitemap and page work and marks report incomplete', async () => {
  const { server, base } = await fixture((req, res) => {
    if (req.url === '/robots.txt' || req.url.endsWith('.xml')) { res.writeHead(404); res.end(); return; }
    res.setHeader('content-type', 'text/html'); res.write('<html>');
    setTimeout(() => res.end('</html>'), 500);
  });
  try {
    const started = Date.now();
    const report = await runAudit({ baseUrl: base, maxPages: 2, timeoutMs: 1000, deadlineMs: 120 });
    assert.ok(Date.now() - started < 400);
    assert.equal(report.health.status, 'incomplete');
    assert.equal(report.health.deadlineExceeded, true);
    assert.equal(report.crawl.pagesEvaluated, 0);
  } finally { await close(server); }
});

test('same-origin redirect records requested and final URLs', async () => {
  const { server, base } = await fixture((req, res) => {
    if (req.url === '/robots.txt') { res.end(''); return; }
    if (req.url === '/sitemap.xml') { res.setHeader('content-type', 'application/xml'); res.end(`<urlset><url><loc>${base}/old</loc></url></urlset>`); return; }
    if (req.url.endsWith('.xml')) { res.writeHead(404); res.end(); return; }
    if (req.url === '/old') { res.writeHead(301, { location: '/new?x=1' }); res.end(); return; }
    res.setHeader('content-type', 'text/html'); res.end(html(base));
  });
  try {
    const report = await runAudit({ baseUrl: `${base}/old`, maxPages: 1, timeoutMs: 1000 });
    assert.equal(report.pages[0].url, `${base}/old`);
    assert.equal(report.pages[0].finalUrl, `${base}/new?x=1`);
    assert.equal(report.urlPolicy.scope, 'exact origin (scheme, hostname, port)');
  } finally { await close(server); }
});

test('robots excludes a sitemap page and request pacing is applied', async () => {
  const times = [];
  const { server, base } = await fixture((req, res) => {
    times.push(Date.now());
    if (req.url === '/robots.txt') { res.end('User-agent: *\nDisallow: /private\n'); return; }
    if (req.url === '/sitemap.xml') { res.setHeader('content-type', 'application/xml'); res.end(`<urlset><url><loc>${base}/private</loc></url></urlset>`); return; }
    if (req.url.endsWith('.xml')) { res.writeHead(404); res.end(); return; }
    res.setHeader('content-type', 'text/html'); res.end(html(base));
  });
  try {
    const report = await runAudit({ baseUrl: base, maxPages: 2, timeoutMs: 1000, delayMs: 30 });
    assert.equal(report.health.status, 'incomplete');
    assert.ok(report.health.errors.some(item => item.url === `${base}/private` && item.error === 'Excluded by robots.txt'));
    assert.equal(report.crawl.pagesFetched, 1);
    assert.ok(times.length >= 3);
    assert.ok(times[1] - times[0] >= 20);
  } finally { await close(server); }
});

test('body timeout remains active and external redirect is rejected', async () => {
  const external = await fixture((req, res) => { res.setHeader('content-type', 'text/html'); res.end(html('http://external.invalid')); });
  const { server, base } = await fixture((req, res) => {
    if (req.url === '/robots.txt' || req.url.endsWith('.xml')) { res.writeHead(404); res.end(); return; }
    if (req.url === '/redirect') { res.writeHead(302, { location: `${external.base}/` }); res.end(); return; }
    res.setHeader('content-type', 'text/html'); res.write('<html>'); setTimeout(() => res.end('</html>'), 350);
  });
  try {
    const started = Date.now();
    const slow = await runAudit({ baseUrl: base, maxPages: 1, timeoutMs: 75 });
    assert.ok(Date.now() - started < 300);
    assert.equal(slow.health.status, 'incomplete');
    const redirected = await runAudit({ baseUrl: `${base}/redirect`, maxPages: 1, timeoutMs: 500 });
    assert.equal(redirected.health.status, 'incomplete');
    assert.equal(redirected.crawl.pagesEvaluated, 0);
  } finally { await close(server); await close(external.server); }
});

test('CLI rejects malformed options before file or network work', () => {
  for (const args of [['--url'], ['--out'], ['--out', '--max-pages', '1'], ['--unknown']]) {
    const result = spawnSync(process.execPath, ['src/cli.js', ...args], { encoding: 'utf8' });
    assert.equal(result.status, 2, args.join(' '));
  }
});
