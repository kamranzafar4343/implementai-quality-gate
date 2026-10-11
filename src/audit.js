import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const DEFAULT_TIMEOUT_MS = 12000;

export function normalizeUrl(input, base) {
  try {
    const url = new URL(input, base);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    url.username = '';
    url.password = '';
    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch { return null; }
}

function sameOrigin(a, b) {
  try { return new URL(a).origin === new URL(b).origin; } catch { return false; }
}
function isHtml(response) { return (response.headers.get('content-type') || '').toLowerCase().includes('text/html'); }
function asArray(value) { return value == null ? [] : Array.isArray(value) ? value : [value]; }

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { redirect: 'follow', signal: controller.signal, headers: { 'user-agent': 'SiteQualityGate/1.0 (+public-site SEO audit)' } }); }
  finally { clearTimeout(timer); }
}

async function fetchText(url, timeoutMs) {
  try {
    const response = await fetchWithTimeout(url, timeoutMs);
    return { ok: response.ok, status: response.status, url: response.url, contentType: response.headers.get('content-type') || '', text: await response.text() };
  } catch (error) {
    return { ok: false, status: null, url, contentType: '', text: '', error: error.name === 'AbortError' ? 'Request timed out' : error.message };
  }
}

async function discoverSitemaps(origin, timeoutMs) {
  const robots = await fetchText(new URL('/robots.txt', origin).toString(), timeoutMs);
  const declared = robots.ok ? [...robots.text.matchAll(/^\s*Sitemap:\s*(\S+)/gim)].map(m => m[1]) : [];
  const candidates = [...declared, ...['/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml', '/wp-sitemap.xml'].map(p => new URL(p, origin).toString())];
  const found = new Set();
  const queue = [...new Set(candidates.map(u => normalizeUrl(u)).filter(Boolean))];
  const sitemapUrls = new Set();
  const maxSitemaps = 30;
  while (queue.length && found.size < maxSitemaps) {
    const url = queue.shift();
    if (found.has(url)) continue;
    found.add(url);
    const result = await fetchText(url, timeoutMs);
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
  return { sitemapFiles: [...sitemapUrls].filter(x => !x.startsWith('PAGE:')).sort(), sitemapPages: [...pages].sort(), robotsStatus: robots.status };
}

async function inspectPage(url, timeoutMs) {
  const result = await fetchText(url, timeoutMs);
  const page = { url, finalUrl: normalizeUrl(result.url) || url, status: result.status, contentType: result.contentType, fetchError: result.error || null, title: null, metaDescription: null, canonical: null, internalLinks: [] };
  if (!result.ok || !isHtml({ headers: { get: () => result.contentType } })) return page;
  const $ = cheerio.load(result.text);
  page.title = $('title').first().text().trim() || null;
  page.metaDescription = $('meta[name="description" i]').first().attr('content')?.trim() || null;
  const canonicalRaw = $('link[rel~="canonical" i]').first().attr('href');
  page.canonical = canonicalRaw ? normalizeUrl(canonicalRaw, result.url) : null;
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;
    const target = normalizeUrl(href, result.url);
    if (target && sameOrigin(target, url) && !/\.(?:pdf|jpg|jpeg|png|gif|svg|webp|zip|docx?|xlsx?|pptx?|mp4|mp3|xml)(?:$|\?)/i.test(new URL(target).pathname)) page.internalLinks.push(target);
  });
  page.internalLinks = [...new Set(page.internalLinks)].sort();
  return page;
}

export function evaluateAudit({ pages, sitemapPages, discoveredUrls, sitemapChecks = [] }) {
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
  for (const page of pages) for (const target of page.internalLinks) linkedFrom.set(target, (linkedFrom.get(target) || 0) + 1);
  for (const url of [...new Set([...discovered, ...sitemapPages])].sort()) {
    if (url !== pages[0]?.url && !linkedFrom.has(url)) issues.push({ rule: 'orphan_candidate', url, message: 'Candidate has no inbound internal links from successfully inspected pages; verify manually.' });
  }
  const counts = Object.fromEntries(['missing_meta_description','meta_description_too_long','title_too_long','missing_canonical','not_in_sitemap','invalid_sitemap_url','orphan_candidate'].map(rule => [rule, issues.filter(i => i.rule === rule).length]));
  return { counts, issues };
}

export async function runAudit({ baseUrl = 'https://implementai.ae', maxPages = 250, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const startUrl = normalizeUrl(baseUrl);
  if (!startUrl) throw new Error(`Invalid base URL: ${baseUrl}`);
  const origin = new URL(startUrl).origin;
  const sitemap = await discoverSitemaps(origin, timeoutMs);
  const queue = [startUrl];
  const queued = new Set(queue);
  const visited = new Map();
  const discoveredUrls = new Set();
  while (queue.length && visited.size < maxPages) {
    const url = queue.shift();
    const page = await inspectPage(url, timeoutMs);
    visited.set(url, page);
    if (page.status >= 200 && page.status < 300 && page.contentType.toLowerCase().includes('text/html')) {
      for (const link of page.internalLinks) {
        discoveredUrls.add(link);
        if (sameOrigin(link, origin) && !queued.has(link) && visited.size + queue.length < maxPages) { queued.add(link); queue.push(link); }
      }
    }
  }
  const sitemapChecks = [];
  for (const url of sitemap.sitemapPages) {
    if (visited.has(url)) {
      const page = visited.get(url);
      sitemapChecks.push({ url, status: page.status, valid: page.status >= 200 && page.status < 300 && page.contentType.toLowerCase().includes('text/html'), error: page.fetchError || undefined });
    } else {
      const page = await inspectPage(url, timeoutMs);
      sitemapChecks.push({ url, status: page.status, valid: page.status >= 200 && page.status < 300 && page.contentType.toLowerCase().includes('text/html'), error: page.fetchError || undefined });
      if (visited.size < maxPages) visited.set(url, page);
    }
  }
  const pages = [...visited.values()].sort((a,b) => a.url.localeCompare(b.url));
  const evaluated = evaluateAudit({ pages, sitemapPages: sitemap.sitemapPages, discoveredUrls, sitemapChecks });
  return {
    tool: { name: 'implementai-site-quality-gate', version: '1.0.0' },
    target: origin,
    generatedAt: new Date().toISOString(),
    configuration: { maxPages, timeoutMs, titleMaxCharacters: 60, metaDescriptionMaxCharacters: 160 },
    crawl: { pagesInspected: pages.length, maxPagesReached: visited.size >= maxPages, robotsStatus: sitemap.robotsStatus, sitemapFiles: sitemap.sitemapFiles, sitemapUrlCount: sitemap.sitemapPages.length, discoveredInternalUrlCount: discoveredUrls.size },
    summary: evaluated.counts,
    issues: evaluated.issues,
    pages
  };
}
