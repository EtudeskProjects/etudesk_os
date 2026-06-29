# Copilot Tools Audit

Generated: 2026-06-29T13:31:53.107Z

Fixture talent: `6ca8920b-58da-4971-872f-5ab6ee9565ee` (preferred slug: `app-review`)

## Summary

| Total | Passed | Failed | Skipped |
|---:|---:|---:|---:|
| 62 | 58 | 0 | 4 |

## By Tool

| Tool | Tests | Failed | Skipped | Total ms | Avg ms | Output KB |
|---|---:|---:|---:|---:|---:|---:|
| execute_action | 5 | 0 | 2 | 11 | 2 | 0.3 |
| file_reader | 1 | 0 | 0 | 0 | 0 | 0.0 |
| generate_diagram | 5 | 0 | 0 | 1 | 0 | 1.2 |
| generate_document | 6 | 0 | 0 | 142 | 24 | 1.9 |
| generate_image | 1 | 0 | 1 | 0 | 0 | 0.0 |
| manage_skills | 3 | 0 | 0 | 490 | 163 | 0.4 |
| smart_search | 8 | 0 | 0 | 5024 | 628 | 13.6 |
| sql_query | 17 | 0 | 0 | 38 | 2 | 27.1 |
| tool_summary | 12 | 0 | 0 | 0 | 0 | 0.0 |
| web_search | 1 | 0 | 1 | 0 | 0 | 0.0 |
| youtube_search | 3 | 0 | 0 | 1798 | 599 | 0.5 |

## Slowest Calls

| Tool | Test | Status | Duration ms | Output KB | Summary |
|---|---|---|---:|---:|---|
| smart_search | Recherche opportunités dev React remote | PASS | 1887 | 2.2 | 5 résultats · opportunités (semantic) |

## Heaviest Outputs

| Tool | Test | Status | Output KB | Keys |
|---|---|---|---:|---|
| sql_query | org_applications | PASS | 12.9 | applications, chart_hint |

## Failed Tests

No failing tool tests.
