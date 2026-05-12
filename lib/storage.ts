"use client";

import type { Workflow, Connection, Run } from "./types";
import { SAMPLE_WORKFLOWS, SAMPLE_CONNECTIONS, SAMPLE_RUNS } from "./samples";

// Tiny localStorage-backed store. Replace with API client when backend lands.

const KEYS = {
  workflows: "obl.portal.workflows.v1",
  connections: "obl.portal.connections.v1",
  runs: "obl.portal.runs.v1",
  seeded: "obl.portal.seeded.v1",
};

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function ensureSeeded() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(KEYS.seeded)) return;
  writeJSON(KEYS.workflows, SAMPLE_WORKFLOWS);
  writeJSON(KEYS.connections, SAMPLE_CONNECTIONS);
  writeJSON(KEYS.runs, SAMPLE_RUNS);
  window.localStorage.setItem(KEYS.seeded, "1");
}

// ── Workflows ───────────────────────────────────────────────────────────────
export function listWorkflows(): Workflow[] {
  ensureSeeded();
  return readJSON<Workflow[]>(KEYS.workflows, []);
}

export function getWorkflow(id: string): Workflow | undefined {
  return listWorkflows().find((w) => w.id === id);
}

export function saveWorkflow(workflow: Workflow): void {
  const list = listWorkflows();
  const idx = list.findIndex((w) => w.id === workflow.id);
  const updated = { ...workflow, updatedAt: new Date().toISOString() };
  if (idx === -1) list.push(updated);
  else list[idx] = updated;
  writeJSON(KEYS.workflows, list);
}

export function deleteWorkflow(id: string): void {
  writeJSON(KEYS.workflows, listWorkflows().filter((w) => w.id !== id));
}

// ── Connections ─────────────────────────────────────────────────────────────
export function listConnections(): Connection[] {
  ensureSeeded();
  return readJSON<Connection[]>(KEYS.connections, []);
}

export function setConnection(c: Connection): void {
  const list = listConnections();
  const idx = list.findIndex((x) => x.id === c.id);
  if (idx === -1) list.push(c);
  else list[idx] = c;
  writeJSON(KEYS.connections, list);
}

// ── Runs ────────────────────────────────────────────────────────────────────
export function listRuns(): Run[] {
  ensureSeeded();
  return readJSON<Run[]>(KEYS.runs, []);
}

// ── Reset (for dev) ─────────────────────────────────────────────────────────
export function resetAll(): void {
  if (typeof window === "undefined") return;
  Object.values(KEYS).forEach((k) => window.localStorage.removeItem(k));
}
