# SiteOne Crawler evaluation

Tested SiteOne Crawler v2.5.1 (MIT) on a controlled local HTTP fixture. The Windows x64 release binary came from the [official release](https://github.com/janreges/siteone-crawler/releases/tag/v2.5.1). No public site was crawled.

Reproduce with `SITEONE_BIN` set to the binary path, then run `node scripts/siteone-evaluation.js`. The script runs separate link and sitemap crawls with JSON output, no cache, and one worker.

| Crawl | Observed URLs | Relevant result |
| --- | --- | --- |
| Link start `/` | `/`, `/linked` | Detected missing description and canonical on `/linked`. |
| Sitemap start `/sitemap.xml` | `/sitemap.xml`, `/`, `/orphan`, `/dead` | Fetched sitemap-only `/orphan` and the dead URL. |
| Dead start `/dead` | `/dead` | Exit code was `0` despite the 404 start URL. |
| Link crawl capped at one visited URL | `/` | Exit code was `0`; `/linked` was not inspected. |

The tool's default title and description length guidance includes minimum lengths and produces many unrelated checks. All four fixture runs exited `0`, including the 404 start and capped crawl. Therefore it is a plausible crawl foundation, but not a drop-in implementation of this gate. A small adapter would need to reconcile the two URL inventories, apply this brief's exact seven rules and limits, and map findings and incomplete coverage to the required exit codes. Keep the current tool until such an adapter is verified against the regression fixtures.
