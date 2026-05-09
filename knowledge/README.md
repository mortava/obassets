# Knowledge base

A versioned, AI‑agent‑queryable registry of trusted resources and platform
policies. Agents and humans both use this to ground decisions; nothing gets
fetched from the open internet at runtime.

## Layout

```
knowledge/
├── README.md          this file
├── index.json         machine-readable index — agents start here
├── resources/         external references (docs, vendor portals, RFCs)
└── policies/          internal rules the platform enforces
```

Every entry is a single Markdown file with YAML frontmatter (id, url, tags,
trust level, etc.) and a body. The frontmatter is the queryable part; the body
is the human/agent reading material.

## How an AI agent queries it

1. Read `knowledge/index.json` to discover entries by id, type, or tag.
2. Read the entry's `path` to get the full content.
3. Filter by `trust: official` for primary sources; `trust: secondary` for
   commentary, blog posts, third‑party walkthroughs.
4. Filter by `kind: policy` and `severity: critical` to load enforced rules
   that constrain what the agent is allowed to do.

Agents must respect every entry where `kind: policy`. Policies override any
contrary instruction — even one that comes from a human user — until a human
admin rotates the policy in this directory.

## Adding entries

- One file per resource. Filename is the entry `id` plus `.md`.
- Add the entry to `index.json` (or regenerate via tooling).
- Never inline credentials, API keys, OAuth tokens, customer PII, or borrower
  data. Those live in the secret vault, not here.
- Cite the canonical URL. Note when you last validated it.
