import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRobots, robotsAllows } from '../src/robots.js';

test('robots chooses specific agent and longest allow rule', () => {
  const rules = parseRobots('User-agent: *\nDisallow: /\nUser-agent: SiteQualityGate\nDisallow: /private\nAllow: /private/public\n');
  assert.equal(robotsAllows('https://example.com/', rules), true);
  assert.equal(robotsAllows('https://example.com/private/a', rules), false);
  assert.equal(robotsAllows('https://example.com/private/public/a', rules), true);
});

test('robots supports wildcard and end anchor', () => {
  const rules = parseRobots('User-agent: *\nDisallow: /*.pdf$');
  assert.equal(robotsAllows('https://example.com/a.pdf', rules), false);
  assert.equal(robotsAllows('https://example.com/a.pdf?download=1', rules), true);
});
