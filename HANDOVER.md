# Handover

The Website Quality Gate is a small Node.js CLI that audits public, server-rendered HTML. It produces terminal and JSON reports for the seven assignment rules. Start with [MANUAL.md](MANUAL.md) for installation, commands, exit codes, report interpretation, and GitHub Actions use.

The updated crawler shares a page budget across link and sitemap discovery, bounds requests and the overall run, records coverage, respects implemented robots exclusions, and supports request pacing. It distinguishes clean, findings, and incomplete audits. External redirects are rejected unless an exact destination host is explicitly allowed as an outbound boundary. The site-specific iMPLEMENTAi command is documented in the manual.

Local HTTP and CLI regression tests cover the failures described in the feedback. [VERIFICATION.md](VERIFICATION.md) records the 14 October 2026 live run and links to its JSON snapshot. The site audit completed with findings; the tool did not modify the website. The code test workflow runs on push and pull request. A separate manual live-audit workflow can enforce findings and upload its report.

[SITEONE_EVALUATION.md](SITEONE_EVALUATION.md) documents the controlled SiteOne comparison. SiteOne was not adopted: an adapter would still need to reconcile link and sitemap inventories and implement this brief's exact rule and coverage policy.

Limits: no JavaScript rendering or authenticated pages; orphan results are candidates for human review. Before a release decision, rerun the live audit and inspect health, coverage, and findings.
