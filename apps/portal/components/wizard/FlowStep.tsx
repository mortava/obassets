"use client";

import { useState } from "react";
import type { Workflow, Step, CatalogTool } from "@/lib/types";
import { FlowCanvas } from "@/components/FlowCanvas";
import { StepPalette } from "@/components/StepPalette";
import { StepInspector } from "@/components/StepInspector";
import { newId } from "@/lib/utils";

export function FlowStep({
  workflow,
  onChange,
  onBack,
  onNext,
}: {
  workflow: Workflow;
  onChange: (next: Workflow) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [paletteOpenAt, setPaletteOpenAt] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = workflow.steps.find((s) => s.id === selectedId) ?? null;

  function setSteps(steps: Step[]) {
    onChange({ ...workflow, steps });
  }

  function addStep(tool: CatalogTool) {
    if (paletteOpenAt === null) return;
    const baseId = tool.id.split(".").pop() || "step";
    let id = baseId;
    let n = 2;
    while (workflow.steps.some((s) => s.id === id)) {
      id = `${baseId}_${n++}`;
    }
    const newStep: Step = { id, use: tool.id, with: {} };
    const next = [...workflow.steps];
    next.splice(paletteOpenAt, 0, newStep);
    setSteps(next);
    setPaletteOpenAt(null);
    setSelectedId(id);
  }

  function moveStep(id: string, dir: -1 | 1) {
    const i = workflow.steps.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= workflow.steps.length) return;
    const next = [...workflow.steps];
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
  }

  function deleteStep(id: string) {
    setSteps(workflow.steps.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function duplicateStep(id: string) {
    const i = workflow.steps.findIndex((s) => s.id === id);
    if (i < 0) return;
    const orig = workflow.steps[i];
    const clone: Step = { ...orig, id: `${orig.id}_copy_${newId("x").slice(2, 5)}`, with: { ...orig.with } };
    const next = [...workflow.steps];
    next.splice(i + 1, 0, clone);
    setSteps(next);
  }

  function updateSelected(s: Step) {
    if (!selectedId) return;
    const next = workflow.steps.map((x) => (x.id === selectedId ? s : x));
    setSteps(next);
    if (s.id !== selectedId) setSelectedId(s.id);
  }

  return (
    <div className="flex flex-col h-[70vh] -mx-6 -mt-6 border-t border-ink-200 rounded-xl overflow-hidden bg-white">
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0">
          <FlowCanvas
            trigger={workflow.trigger}
            steps={workflow.steps}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={moveStep}
            onDelete={deleteStep}
            onDuplicate={duplicateStep}
            onAddAt={(i) => setPaletteOpenAt(i)}
          />
        </div>
        {selected && (
          <StepInspector
            step={selected}
            onChange={updateSelected}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      <div className="h-14 border-t border-ink-200 bg-white flex items-center justify-between px-6 shrink-0">
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <div className="text-xs text-ink-500">
          {workflow.steps.length} {workflow.steps.length === 1 ? "step" : "steps"}
        </div>
        <button className="btn-primary" onClick={onNext} disabled={workflow.steps.length === 0}>
          Continue to connect →
        </button>
      </div>

      {paletteOpenAt !== null && (
        <StepPalette
          onPick={addStep}
          onClose={() => setPaletteOpenAt(null)}
        />
      )}
    </div>
  );
}
