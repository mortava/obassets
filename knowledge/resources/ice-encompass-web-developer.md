---
id: ice-encompass-web-developer
title: Encompass Web — Developer Resources
url: https://developer.icemortgagetechnology.com/developer-connect/docs/encompass-web-developer
publisher: ICE Mortgage Technology
category: developer-docs
trust: official
tags:
  - encompass-web
  - browser-extensions
  - input-form-builder
  - custom-forms
  - business-rules
  - ui-customization
  - field-mapping
addedAt: 2026-05-09
lastValidated: 2026-05-09
status: active
relatedEntries:
  - ice-encompass-developer-connect
  - policy-no-deletion
---

# Encompass Web — Developer Resources

Developer guidance specific to the **Encompass Web** experience (the modern
browser‑based front end). Companion to the Developer Connect REST API hub.

## Why this matters to the platform

Workflows that surface back to Encompass users — adding conditions, posting
notes, advancing milestones — depend on knowing how the Encompass Web UI
expects fields, forms, and rules to behave. The page indexes the bits of
Encompass Web extensibility that affect server‑side automations:

- **Input form behavior** — which fields are user‑editable, which are
  driven by business rules, which are read‑only in the Web client.
- **Custom form / persona rules** — what the user sees is conditioned on
  persona; AI‑generated suggestions need to land in fields a real persona can
  approve.
- **Field id taxonomy** — Encompass field ids are tenant‑configured. The
  platform's per‑tenant logical alias map (see `docs/ARCHITECTURE.md` ADR‑0004)
  resolves logical names to the tenant's actual field ids before any write.
- **Browser extension surface** — for tenants that want a side‑panel inside
  Encompass Web showing live workflow status, the platform exposes a
  thin extension; this page is the canonical reference for how the host
  app loads it.

## Critical reads (cross‑references)

- Input form rules vs. business rules — when each fires
- Persona‑scoped permissions and field‑level read/write
- Encompass Web extension manifest format
- Loan workspace layout (panes, tabs, custom forms)

## Constraints the platform enforces

- The platform never silently writes to a field a persona cannot edit.
  Workflow YAML referencing a write‑locked field fails preflight.
- Persona‑scoped data hidden from a user is also redacted from any AI prompt
  generated on that user's behalf.
- The "never delete data" rule applies to every write path documented here.
  See [`policy-no-deletion`](../policies/no-deletion.md).
