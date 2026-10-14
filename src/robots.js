const AGENT = 'sitequalitygate';

export function parseRobots(text) {
  const groups = [];
  let agents = [];
  let rules = [];
  let inRules = false;
  const flush = () => { if (agents.length) groups.push({ agents, rules }); agents = []; rules = []; inRules = false; };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split('#', 1)[0].trim();
    if (!line) continue;
    const match = /^([^:]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1].trim().toLowerCase();
    const value = match[2].trim();
    if (key === 'user-agent') {
      if (inRules) flush();
      agents.push(value.toLowerCase());
    } else if (key === 'allow' || key === 'disallow') {
      if (!agents.length) continue;
      inRules = true;
      if (value) rules.push({ allow: key === 'allow', pattern: value });
    }
  }
  flush();
  const specific = groups.filter(group => group.agents.some(agent => agent !== '*' && AGENT.startsWith(agent)));
  return (specific.length ? specific : groups.filter(group => group.agents.includes('*'))).flatMap(group => group.rules);
}

export function robotsAllows(url, rules) {
  const path = new URL(url).pathname + new URL(url).search;
  let winner = null;
  for (const rule of rules) {
    const endAnchored = rule.pattern.endsWith('$');
    const source = endAnchored ? rule.pattern.slice(0, -1) : rule.pattern;
    const escaped = source.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + (endAnchored ? '$' : '');
    if (!new RegExp(`^${escaped}`).test(path)) continue;
    const length = rule.pattern.replace(/[\*$]/g, '').length;
    if (!winner || length > winner.length || (length === winner.length && rule.allow)) winner = { length, allow: rule.allow };
  }
  return winner?.allow ?? true;
}
