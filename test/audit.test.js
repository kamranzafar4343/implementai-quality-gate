import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, evaluateAudit } from '../src/audit.js';

test('normalizes fragments and trailing slashes', () => {
  assert.equal(normalizeUrl('https://example.com/page/#section'), 'https://example.com/page');
  assert.equal(normalizeUrl('/about/', 'https://example.com'), 'https://example.com/about');
  assert.equal(normalizeUrl('mailto:test@example.com'), null);
});

test('flags missing metadata and overlong title/description', () => {
  const pages = [
    { url: 'https://example.com/', status: 200, contentType: 'text/html', fetchError: null, title: 'T'.repeat(61), metaDescription: null, canonical: null, internalLinks: [] },
    { url: 'https://example.com/long', status: 200, contentType: 'text/html', fetchError: null, title: 'Short', metaDescription: 'D'.repeat(161), canonical: 'https://example.com/long', internalLinks: [] }
  ];
  const result = evaluateAudit({ pages, sitemapPages: ['https://example.com/'], discoveredUrls: new Set(['https://example.com/long']), sitemapChecks: [] });
  assert.equal(result.counts.missing_meta_description, 1);
  assert.equal(result.counts.meta_description_too_long, 1);
  assert.equal(result.counts.title_too_long, 1);
  assert.equal(result.counts.missing_canonical, 1);
});

test('flags discovered URLs missing from sitemap, invalid sitemap URLs, and orphan candidates', () => {
  const pages = [{ url: 'https://example.com/', status: 200, contentType: 'text/html', fetchError: null, title: 'Home', metaDescription: 'ok', canonical: 'https://example.com/', internalLinks: ['https://example.com/linked'] }, { url: 'https://example.com/linked', status: 200, contentType: 'text/html', fetchError: null, title: 'Linked', metaDescription: 'ok', canonical: 'https://example.com/linked', internalLinks: [] }];
  const result = evaluateAudit({ pages, sitemapPages: ['https://example.com/', 'https://example.com/orphan', 'https://example.com/dead'], discoveredUrls: new Set(['https://example.com/linked', 'https://example.com/not-in-map']), sitemapChecks: [{ url: 'https://example.com/dead', status: 404, valid: false }] });
  assert.equal(result.counts.not_in_sitemap, 2);
  assert.equal(result.counts.invalid_sitemap_url, 1);
  assert.ok(result.issues.some(i => i.rule === 'orphan_candidate' && i.url === 'https://example.com/orphan'));
});

test('does not report metadata issues for non-HTML or failed pages', () => {
  const result = evaluateAudit({ pages: [{ url: 'https://example.com/file.pdf', status: 200, contentType: 'application/pdf', title: null, metaDescription: null, canonical: null, internalLinks: [] }, { url: 'https://example.com/missing', status: 404, contentType: 'text/html', title: null, metaDescription: null, canonical: null, internalLinks: [] }], sitemapPages: [], discoveredUrls: new Set(), sitemapChecks: [] });
  assert.equal(result.counts.missing_meta_description, 0);
  assert.equal(result.counts.missing_canonical, 0);
});
