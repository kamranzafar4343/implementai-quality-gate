import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_DEADLINE_MS = 120000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export function normalizeUrl(input, base) {
  try {
    const url = new URL(input, base);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    url.username = '';
    url.password = '';
    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
    return url.toString();
  } catch { return null; }
}

function sameOrigin(a, b) {
  try { return new URL(a).origin === new URL(b).origin; } catch { return false; }
}
function isHtml(response) { return (response.headers.get('content-type') || '').toLowerCase().includes('text/html'); }
function asArray(value) { return value == null ? [] : Array.isArray(value) ? value : [value]; }

async function fetchWithTimeout(url, timeoutMs, origin, deadline) {
  const remainingMs = Math.min(timeoutMs, deadline - Date.now());
  if (remainingMs <= 0) return { ok: false, status: null, url, error: 'Audit deadline exceeded' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remainingMs);
  try {
    let current = url;
    for (let redirects = 0; redirects <= 5; redirects++) {
      const response = await fetch(current, { redirect: 'manual', signal: controller.signal, headers: { 'user-agent': 'SiteQualityGate/1.0 (+public-site SEO audit)' } });
      if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
        const next = normalizeUrl(response.headers.get('location'), current);
        if (!next || !sameOrigin(next, origin)) return { ok: false, status: response.status, url: next || current, error: 'Redirect leaves the audit origin', outOfScope: true };
        current = next;
        continue;
      }
      const chunks = [];
      let size = 0;
      if (response.body) for await (const chunk of response.body) {
        size += chunk.byteLength;
        if (size > MAX_RESPONSE_BYTES) { controller.abort(); return { ok: false, status: response.status, url: current, error: 'Response size limit exceeded' }; }
        chunks.push(chunk);
      }
      return { ok: response.ok, status: response.status, url: current, contentType: response.headers.get('content-type') || '', text: Buffer.concat(chunks).toString('utf8') };
    }
    return { ok: false, status: null, url: current, error: 'Too many redirects' };
  } finally { clearTimeout(timer); }
}

async function fetchText(url, timeoutMs, origin = new URL(url).origin, deadline = Infinity) {
  try {
    return await fetchWithTimeout(url, timeoutMs, origin, deadline);
  } catch (error) {
    return { ok: false, status: null, url, contentType: '', text: '', error: error.name === 'AbortError' ? Date.now() >= deadline ? 'Audit deadline exceeded' : 'Request timed out' : error.message };
  }
}

async function discoverSitemaps(origin, timeoutMs, deadline) {
  const robots = await fetchText(new URL('/robots.txt', origin).toString(), timeoutMs, origin, deadline);
  const declared = robots.ok ? [...robots.text.matchAll(/^\s*Sitemap:\s*(\S+)/gim)].map(m => m[1]) : [];
  const candidates = [...declared, ...['/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml', '/wp-sitemap.xml'].map(p => new URL(p, origin).toString())];
  const found = new Set();
  const queue = [...new Set(candidates.map(u => normalizeUrl(u)).filter(u => u && sameOrigin(u, origin)))];
  const sitemapUrls = new Set();
  const maxSitemaps = 30;
  while (queue.length && found.size < maxSitemaps && Date.now() < deadline) {
    const url = queue.shift();
    if (found.has(url)) continue;
    found.add(url);
    const result = await fetchText(url, timeoutMs, origin, deadline);
    if (!result.ok || !/<(?:\w+:)?(?:urlset|sitemapindex)\b/i.test(result.text.slice(0, 5000))) continue;
    sitemapUrls.add(url);
    let parsed;
    try { parsed = xmlParser.parse(result.text); } catch { continue; }
    const rootKey = Object.keys(parsed).find(k => /(?:urlset|sitemapindex)$/i.test(k));
    if (!rootKey) continue;
    const root = parsed[rootKey];
    if (/sitemapindex$/i.test(rootKey)) {
      for (const child of asArray(root.sitemap).map(x => x?.loc).filter(Boolean)) {
        const childUrl = normalizeUrl(child);
        if (childUrl && sameOrigin(childUrl, origin) && !found.has(childUrl)) queue.push(childUrl);
      }
    } else {
      for (const entry of asArray(root.url).map(x => x?.loc).filter(Boolean)) {
        const pageUrl = normalizeUrl(entry);
        if (pageUrl && sameOrigin(pageUrl, origin)) sitemapUrls.add(`PAGE:${pageUrl}`);
      }
    }
  }
  const pages = new Set([...sitemapUrls].filter(x => x.startsWith('PAGE:')).map(x => x.slice(5)));
  return { sitemapFiles: [...sitemapUrls].filter(x => !x.startsWith('PAGE:')).sort(), sitemapPages: [...pages].sort(), robotsStatus: robots.status, incomplete: queue.length > 0 };
}

async function inspectPage(url, timeoutMs, origin, deadline) {
  const result = await fetchText(url, timeoutMs, origin, deadline);
  const page = { url, finalUrl: normalizeUrl(result.url) || url, status: result.status, contentType: result.contentType || '', fetchError: result.error || null, outOfScope: !!result.outOfScope, title: null, metaDescription: null, canonical: null, internalLinks: [] };
  if (!result.ok || !isHtml({ headers: { get: () => result.contentType } })) return page;
  const $ = cheerio.load(result.text);
  page.title = $('title').first().text().trim() || null;
  page.metaDescription = $('meta[name="description" i]').first().attr('content')?.trim() || null;
  const canonicalRaw = $('link[rel~="canonical" i]').first().attr('href');
  page.canonical = canonicalRaw ? normalizeUrl(canonicalRaw, result.url) : null;
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;
    const target = normalizeUrl(href, page.finalUrl);
    if (target && sameOrigin(target, url) && !/\.(?:pdf|jpg|jpeg|png|gif|svg|webp|zip|docx?|xlsx?|pptx?|mp4|mp3|xml)(?:$|\?)/i.test(new URL(target).pathname)) page.internalLinks.push(target);
  });
  page.internalLinks = [...new Set(page.internalLinks)].sort();
  return page;
}

export function evaluateAudit({ pages, sitemapPages, discoveredUrls, sitemapChecks = [], startUrl = pages[0]?.url }) {
  const issues = [];
  for (const page of pages) {
    if (!page.fetchError && page.status >= 200 && page.status < 300 && page.contentType.toLowerCase().includes('text/html')) {
      if (!page.metaDescription) issues.push({ rule: 'missing_meta_description', url: page.url, message: 'Meta description is missing or empty.' });
      else if (page.metaDescription.length > 160) issues.push({ rule: 'meta_description_too_long', url: page.url, length: page.metaDescription.length, message: `Meta description is ${page.metaDescription.length} characters (limit: 160).` });
      if (page.title && page.title.length > 60) issues.push({ rule: 'title_too_long', url: page.url, length: page.title.length, message: `Page title is ${page.title.length} characters (limit: 60).` });
      if (!page.canonical) issues.push({ rule: 'missing_canonical', url: page.url, message: 'Canonical URL is missing or invalid.' });
    }
  }
  const discovered = new Set(discoveredUrls);
  for (const url of [...discovered].sort()) if (!sitemapPages.includes(url)) issues.push({ rule: 'not_in_sitemap', url, message: 'Discovered through internal links but not present in the sitemap.' });
  for (const item of sitemapChecks) if (!item.valid) issues.push({ rule: 'invalid_sitemap_url', url: item.url, status: item.status, message: item.error || `Sitemap URL did not return a valid live HTML page (status ${item.status ?? 'unknown'}).` });
  const linkedFrom = new Map();
  const live = new Set(pages.filter(page => !page.fetchError && page.status >= 200 && page.status < 300 && page.contentType.toLowerCase().includes('text/html')).map(page => page.url));
  for (const page of pages.filter(page => live.has(page.url))) for (const target of page.internalLinks) if (target !== page.url) linkedFrom.set(target, (linkedFrom.get(target) || 0) + 1);
  for (const url of [...new Set(sitemapPages)].sort()) {
    if (url !== startUrl && live.has(url) && !linkedFrom.has(url)) issues.push({ rule: 'orphan_candidate', url, message: 'Candidate has no inbound internal links from successfully inspected pages; verify manually.' });
  }
  const counts = Object.fromEntries(['missing_meta_description','meta_description_too_long','title_too_long','missing_canonical','not_in_sitemap','invalid_sitemap_url','orphan_candidate'].map(rule => [rule, issues.filter(i => i.rule === rule).length]));
  return { counts, issues };
}

export async function runAudit({ baseUrl = 'https://implementai.ae', maxPages = 250, timeoutMs = DEFAULT_TIMEOUT_MS, deadlineMs = DEFAULT_DEADLINE_MS } = {}) {
  const startUrl = normalizeUrl(baseUrl);
  if (!startUrl) throw new Error(`Invalid base URL: ${baseUrl}`);
  if (!Number.isInteger(maxPages) || maxPages < 1 || !Number.isInteger(timeoutMs) || timeoutMs < 1 || !Number.isInteger(deadlineMs) || deadlineMs < 1) throw new Error('Invalid audit limits');
  const deadline = Date.now() + deadlineMs;
  const origin = new URL(startUrl).origin;
  const sitemap = await discoverSitemaps(origin, timeoutMs, deadline);
  const queue = [startUrl, ...sitemap.sitemapPages.filter(url => url !== startUrl)];
  const queued = new Set(queue);
  const visited = new Map();
  const discoveredUrls = new Set();
  while (queue.length && visited.size < maxPages && Date.now() < deadline) {
    const url = queue.shift();
    const page = await inspectPage(url, timeoutMs, origin, deadline);
    visited.set(url, page);
    if (!page.fetchError && page.status >= 200 && page.status < 300 && page.contentType.toLowerCase().includes('text/html')) {
      for (const link of page.internalLinks) {
        discoveredUrls.add(link);
        if (sameOrigin(link, origin) && !queued.has(link)) { queued.add(link); queue.push(link); }
      }
    }
  }
  const sitemapChecks = sitemap.sitemapPages.filter(url => visited.has(url)).map(url => {
    const page = visited.get(url);
    return { url, status: page.status, valid: !page.fetchError && page.status >= 200 && page.status < 300 && page.contentType.toLowerCase().includes('text/html'), error: page.fetchError || undefined };
  });
  const pages = [...visited.values()].sort((a,b) => a.url.localeCompare(b.url));
  const evaluated = evaluateAudit({ pages, sitemapPages: sitemap.sitemapPages, discoveredUrls, sitemapChecks, startUrl });
  const errors = pages.filter(page => page.fetchError).map(page => ({ url: page.url, error: page.fetchError }));
  const root = visited.get(startUrl);
  if (!root || root.status < 200 || root.status >= 300 || !root.contentType.toLowerCase().includes('text/html')) errors.unshift({ url: startUrl, error: root?.fetchError || `Start URL did not return valid HTML (status ${root?.status ?? 'unknown'})` });
  if (sitemap.sitemapFiles.length === 0) errors.push({ url: origin, error: 'No readable sitemap was found' });
  const skippedUrls = [...new Set(queue)];
  const deadlineExceeded = Date.now() >= deadline;
  if (deadlineExceeded) errors.push({ url: startUrl, error: 'Audit deadline exceeded' });
  const incomplete = errors.length > 0 || skippedUrls.length > 0 || sitemap.incomplete;
  return {
    tool: { name: 'implementai-site-quality-gate', version: '1.0.0' },
    target: origin,
    generatedAt: new Date().toISOString(),
    configuration: { maxPages, timeoutMs, deadlineMs, titleMaxCharacters: 60, metaDescriptionMaxCharacters: 160 },
    urlPolicy: { scope: 'exact origin (scheme, hostname, port)', redirects: 'up to five, same origin only', identity: 'fragments ignored; query strings and trailing slashes distinct; redirects retain requested and final URLs; canonicals reported but do not merge URLs' },
    health: { status: incomplete ? 'incomplete' : evaluated.issues.length ? 'findings' : 'clean', errors, skippedUrls, sitemapDiscoveryIncomplete: sitemap.incomplete, deadlineExceeded },
    crawl: { pagesInspected: pages.length, pagesRequested: queued.size, pagesFetched: pages.filter(page => page.status !== null).length, pagesEvaluated: pages.filter(page => !page.fetchError && page.status >= 200 && page.status < 300 && page.contentType.toLowerCase().includes('text/html')).length, pagesSkipped: skippedUrls.length, pagesRemaining: skippedUrls.length, maxPagesReached: skippedUrls.length > 0 && visited.size >= maxPages, robotsStatus: sitemap.robotsStatus, sitemapFiles: sitemap.sitemapFiles, sitemapUrlCount: sitemap.sitemapPages.length, discoveredInternalUrlCount: discoveredUrls.size },
    summary: evaluated.counts,
    issues: evaluated.issues,
    pages
  };
}
