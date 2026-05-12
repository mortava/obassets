# OpenBroker Portal

A Next.js + Tailwind portal for designing, running, and observing AI workflows
on **Encompass Developer Connect** and **TPO Connect**.

## Run it locally

```bash
npm install
npm run dev
# → http://localhost:3000
```

Workflows and connections are stored in **browser localStorage** in this first
cut so the portal works without a backend. The wizard, dashboard, run history,
and YAML preview are all live; the actual EDC adapter / runtime described in
[`../../docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) is the follow-on
work in Phase 1 of the roadmap.

## What's in the portal

| Route | Purpose |
|---|---|
| `/` | Dashboard — KPIs and the workflow grid |
| `/new` | The 6-step wizard: **Goal → Trigger → Flow → Connect → Review → Publish** |
| `/workflows/[id]` | Workflow detail — visual flow, YAML, runs |
| `/runs` | All runs across workflows |
| `/connections` | Connect Encompass, Anthropic, Slack, email |
| `/templates` | Starter workflows you can clone |
| `/settings` | Tenant defaults + reset demo data |

## The 6-step building-block flow

1. **Goal** — name the workflow and (optionally) start from a template
2. **Trigger** — pick what fires it (field change, milestone, document, schedule, manual, custom webhook) and configure
3. **Flow** — drop in steps from a categorized palette (Encompass · AI · Human · Notify · Flow control); each step has its own form
4. **Connect** — verify the systems your steps need are linked; required ones are flagged
5. **Review** — visual flow + YAML side-by-side, plus preflight checks (side-effect-before-read, missing AI schema, destructive-without-approval, PII redaction)
6. **Publish** — choose Sandbox or Production and activate, or save as draft

## Visual conventions

- **Encompass / TPO steps** — dark icons (the system of record)
- **AI steps** — purple (`ai.*`)
- **Human steps** — amber (someone needs to act)
- **Notify steps** — blue
- **Flow control** — neutral
- The trigger card sits at the top of the canvas in brand color; steps connect downward with thin lines and "+" insert points between every pair

## Files

```
.
├── app/                       Next.js App Router pages
│   ├── page.tsx               Dashboard
│   ├── new/page.tsx           Wizard (orchestrates the 6 steps)
│   ├── workflows/[id]/page.tsx
│   ├── runs/page.tsx
│   ├── connections/page.tsx
│   ├── templates/page.tsx
│   └── settings/page.tsx
├── components/
│   ├── AppShell.tsx           Sidebar + topbar layout
│   ├── Sidebar.tsx
│   ├── Topbar.tsx
│   ├── WorkflowCard.tsx
│   ├── Stepper.tsx            Wizard progress bar
│   ├── FlowCanvas.tsx         Vertical flow renderer
│   ├── StepCard.tsx           One step in the flow
│   ├── StepPalette.tsx        Modal for picking a step type
│   ├── StepInspector.tsx      Right-side form for editing a step
│   ├── YamlPreview.tsx
│   └── wizard/
│       ├── GoalStep.tsx
│       ├── TriggerStep.tsx
│       ├── FlowStep.tsx
│       ├── ConnectStep.tsx
│       ├── ReviewStep.tsx
│       └── PublishStep.tsx
└── lib/
    ├── types.ts               Workflow / Trigger / Step / Connection / Run
    ├── catalog.ts             Tool catalog (edc.* / ai.* / human.* / notify.* / flow.*)
    ├── samples.ts             Demo workflows, connections, runs, templates
    ├── storage.ts             localStorage CRUD
    ├── yaml.ts                Workflow → YAML serializer (no js-yaml dep)
    └── utils.ts               cls / time / fmt helpers
```

## Next steps (after this branch)

1. Wire `lib/storage.ts` to a real API (Supabase candidate per
   `docs/ARCHITECTURE.md`).
2. Implement the ICE adapter package and the workflow engine activities so
   "Activate" actually subscribes to webhooks and runs steps.
3. Add the human-task inbox under `/inbox` (currently surfaced via `runs/`).
4. Add `react-flow` for branched / parallel flow visualization once we go
   beyond linear graphs.
