import type { Workflow } from "./types";

// A small, deterministic YAML emitter for our specific workflow shape.
// Avoids pulling in js-yaml. Quotes when needed, uses block style for arrays.

function emitScalar(v: unknown): string {
  if (v === null || v === undefined) return '""';
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  const s = String(v);
  // Multiline strings → block scalar
  if (s.includes("\n")) {
    const lines = s.split("\n").map((l) => "  " + l).join("\n");
    return "|\n" + lines;
  }
  // Reserved YAML words / template strings / special chars → quote
  if (
    s === "" ||
    /^(yes|no|true|false|null|on|off)$/i.test(s) ||
    /^[\d\-+.]/.test(s) ||
    /[:#&*!|>'%@`]/.test(s) ||
    /^\s|\s$/.test(s)
  ) {
    return JSON.stringify(s);
  }
  return s;
}

function emitObject(obj: Record<string, unknown>, indent: number): string[] {
  const pad = "  ".repeat(indent);
  const lines: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) {
        lines.push(`${pad}${k}: []`);
        continue;
      }
      lines.push(`${pad}${k}:`);
      for (const item of v) {
        if (typeof item === "object" && item !== null) {
          const inner = emitObject(item as Record<string, unknown>, indent + 1);
          // Replace the leading pad of the first inner line with `- `
          const firstPad = "  ".repeat(indent + 1);
          if (inner.length > 0) {
            inner[0] = `${pad}  - ${inner[0].slice(firstPad.length)}`;
            for (let i = 1; i < inner.length; i++) {
              inner[i] = "  " + inner[i];
            }
            lines.push(...inner);
          }
        } else {
          lines.push(`${pad}  - ${emitScalar(item)}`);
        }
      }
    } else if (typeof v === "object" && v !== null) {
      lines.push(`${pad}${k}:`);
      lines.push(...emitObject(v as Record<string, unknown>, indent + 1));
    } else {
      lines.push(`${pad}${k}: ${emitScalar(v)}`);
    }
  }
  return lines;
}

function cleanTrigger(t: Workflow["trigger"]) {
  // Drop undefined / empty fields so YAML is tidy.
  const out: Record<string, unknown> = { source: t.source };
  for (const [k, v] of Object.entries(t)) {
    if (k === "source") continue;
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

function cleanStep(s: Workflow["steps"][number]) {
  const out: Record<string, unknown> = { id: s.id, use: s.use };
  if (s.if) out.if = s.if;
  if (s.timeout) out.timeout = s.timeout;
  const withClean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s.with || {})) {
    if (v === undefined || v === null || v === "") continue;
    withClean[k] = v;
  }
  if (Object.keys(withClean).length > 0) out.with = withClean;
  return out;
}

export function workflowToYaml(w: Workflow): string {
  const doc = {
    apiVersion: "obl.workflows/v1",
    kind: "Workflow",
    metadata: {
      id: w.id,
      version: 1,
      owner: "you@example.com",
      description: w.description || undefined,
    },
    trigger: cleanTrigger(w.trigger),
    steps: (w.steps || []).map(cleanStep),
  };
  return emitObject(doc, 0).join("\n") + "\n";
}
