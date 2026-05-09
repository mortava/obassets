"use client";

import { X } from "lucide-react";
import type { Step } from "@/lib/types";
import { CATALOG_BY_ID } from "@/lib/catalog";
import { slug } from "@/lib/utils";

export function StepInspector({
  step,
  onChange,
  onClose,
}: {
  step: Step;
  onChange: (next: Step) => void;
  onClose: () => void;
}) {
  const tool = CATALOG_BY_ID[step.use];

  function setWith(name: string, value: unknown) {
    onChange({ ...step, with: { ...step.with, [name]: value } });
  }

  return (
    <aside className="w-[360px] shrink-0 border-l border-ink-200 bg-white flex flex-col">
      <div className="h-12 px-4 flex items-center justify-between border-b border-ink-200 shrink-0">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-ink-400">Configure step</div>
          <div className="text-sm font-semibold text-ink-900 truncate">{tool?.label ?? step.use}</div>
        </div>
        <button className="text-ink-500 hover:text-ink-900" onClick={onClose}><X className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="label">Step ID</label>
          <input
            className="input font-mono text-xs"
            value={step.id}
            onChange={(e) => onChange({ ...step, id: slug(e.target.value).replace(/-/g, "_") })}
          />
          <p className="mt-1 text-[11px] text-ink-500">Used to reference outputs: <code className="font-mono">steps.{step.id}.output</code></p>
        </div>

        {tool?.inputs.map((input) => (
          <div key={input.name}>
            <label className="label">
              {input.label} {input.required && <span className="text-red-500">*</span>}
            </label>
            {renderInput(input.kind, input.placeholder, input.options, step.with[input.name], (v) => setWith(input.name, v))}
            {input.help && <p className="mt-1 text-[11px] text-ink-500">{input.help}</p>}
          </div>
        ))}

        <div className="pt-2 border-t border-ink-200">
          <label className="label">Run only if (optional)</label>
          <input
            className="input font-mono text-xs"
            value={step.if || ""}
            onChange={(e) => onChange({ ...step, if: e.target.value || undefined })}
            placeholder="steps.ai_triage.output.recommendation == 'return_to_broker'"
          />
        </div>

        <div>
          <label className="label">Timeout (optional)</label>
          <input
            className="input"
            value={step.timeout || ""}
            onChange={(e) => onChange({ ...step, timeout: e.target.value || undefined })}
            placeholder="60s"
          />
        </div>
      </div>
    </aside>
  );
}

function renderInput(
  kind: string,
  placeholder: string | undefined,
  options: { value: string; label: string }[] | undefined,
  value: unknown,
  onChange: (v: unknown) => void
) {
  switch (kind) {
    case "text":
      return (
        <textarea
          className="input min-h-[80px] font-mono text-xs"
          placeholder={placeholder}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "select":
      return (
        <select
          className="input"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Choose…</option>
          {options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    case "boolean":
      return (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="text-sm text-ink-700">Enabled</span>
        </label>
      );
    case "number":
      return (
        <input
          type="number"
          className="input"
          placeholder={placeholder}
          value={(value as number) ?? ""}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      );
    case "json":
      return (
        <textarea
          className="input min-h-[100px] font-mono text-xs"
          placeholder={placeholder}
          value={typeof value === "string" ? value : value === undefined ? "" : JSON.stringify(value, null, 2)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default:
      return (
        <input
          className="input"
          placeholder={placeholder}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
