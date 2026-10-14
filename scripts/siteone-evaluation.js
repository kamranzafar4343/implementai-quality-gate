import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const binary = process.env.SITEONE_BIN;
if (!binary) throw new Error('Set SITEONE_BIN to the SiteOne Crawler binary path');
const server = createServer((req, res) => {
  if (req.url === '/robots.txt') { res.end('User-agent: *\nAllow: /'); return; }
  if (req.url === '/sitemap.xml') {
    res.setHeader('content-type', 'application/xml');
    res.end(`<urlset><url><loc>${base}/</loc></url><url><loc>${base}/orphan</loc></url><url><loc>${base}/dead</loc></url></urlset>`);
    return;
  }
  if (req.url === '/dead') { res.writeHead(404); res.end(); return; }
  res.setHeader('content-type', 'text/html');
  const links = req.url === '/' ? '<a href="/linked">linked</a>' : '';
  const metadata = req.url === '/linked' ? '' : `<title>Good</title><meta name="description" content="Good"><link rel="canonical" href="${base}${req.url}">`;
  res.end(`<html><head>${metadata}</head><body>${links}</body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

function run(url, extra = []) {
  return new Promise(resolve => {
    const child = spawn(binary, [`--url=${url}`, '--output=json', '--no-cache', '--workers=1', '--output-json-file=', '--output-html-report=', '--output-text-file=', ...extra], { windowsHide: true });
    let output = ''; let errors = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { errors += chunk; });
    child.on('close', code => {
      let report;
      try { report = JSON.parse(output); } catch { report = null; }
      resolve({ code, resultCount: report?.results?.length, resultPaths: Array.isArray(report?.results) ? report.results.map(item => new URL(item.url ?? item.requestUrl).pathname) : [], seoRows: report?.tables?.seo?.rows?.map(row => ({ path: row.urlPathAndQuery, title: row.title, description: row.description })) ?? [], seoNotices: report?.summary?.items?.filter(item => item.aplCode?.startsWith('seo-')).map(item => ({ code: item.aplCode, status: item.status, text: item.text })) ?? [], ciGate: report?.ciGate?.checks?.filter(item => !item.passed) });
    });
  });
}
try {
  for (const scenario of [{ path: '/' }, { path: '/sitemap.xml' }, { path: '/dead' }, { path: '/', extra: ['--max-visited-urls=1'] }, { path: '/dead', extra: ['--ci', '--ci-min-pages=1', '--ci-min-assets=0'] }, { path: '/', extra: ['--max-visited-urls=1', '--ci', '--ci-min-pages=1', '--ci-min-assets=0'] }]) {
    const result = await run(`${base}${scenario.path}`, scenario.extra);
    console.log(JSON.stringify({ scenario, ...result }, null, 2));
  }
} finally { await new Promise(resolve => server.close(resolve)); }
