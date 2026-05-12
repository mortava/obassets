"use client";

import { Plus, ChevronDown } from "lucide-react";
import type { Step, Trigger } from "@/lib/types";
import { StepCard, TriggerSummaryCard } from "./StepCard";

export function FlowCanvas({
  trigger,
  steps,
  selectedId,
  onSelect,
  onMove,
  onDelete,
  onDuplicate,
  onAddAt,
}: {
  trigger: Trigger;
  steps: Step[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAddAt: (index: number) => void;
}) {
  return (
    <div className="flow-grid h-full overflow-y-auto p-8">
      <div className="max-w-xl mx-auto space-y-2">
        {/* Trigger */}
        <TriggerSummaryCard trigger={trigger} />

        <Connector />
        <InsertButton onClick={() => onAddAt(0)} />

        {steps.length === 0 ? (
          <EmptyFlowHint onAdd={() => onAddAt(0)} />
        ) : (
          steps.map((step, i) => (
            <div key={step.id}>
              <Connector />
              <div className="group">
                <StepCard
                  step={step}
                  index={i}
                  selected={selectedId === step.id}
                  onSelect={() => onSelect(selectedId === step.id ? null : step.id)}
                  onMoveUp={() => onMove(step.id, -1)}
                  onMoveDown={() => onMove(step.id, 1)}
                  onDelete={() => onDelete(step.id)}
                  onDuplicate={() => onDuplicate(step.id)}
                  canUp={i > 0}
                  canDown={i < steps.length - 1}
                />
              </div>
              <Connector />
              <InsertButton onClick={() => onAddAt(i + 1)} />
            </div>
          ))
        )}

        {steps.length > 0 && (
          <>
            <Connector />
            <div className="card border-dashed bg-ink-50/50 p-3 text-center text-xs text-ink-500">
              End of workflow
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Connector() {
  return (
    <div className="flex justify-center">
      <div className="w-px h-5 bg-ink-300" />
    </div>
  );
}

function InsertButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-ink-300 bg-white px-3 py-1 text-xs text-ink-500 hover:text-ink-900 hover:border-ink-500 hover:shadow-card transition-all"
      >
        <Plus className="w-3 h-3" />
        Add step
      </button>
    </div>
  );
}

function EmptyFlowHint({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card border-dashed border-2 border-ink-300 bg-white p-8 text-center">
      <ChevronDown className="w-5 h-5 mx-auto text-ink-400 mb-2" />
      <h4 className="text-sm font-semibold text-ink-900">No steps yet</h4>
      <p className="text-xs text-ink-500 mt-1 mb-4">
        After your trigger fires, what should happen? Start by pulling loan data, then add an AI step.
      </p>
      <button onClick={onAdd} className="btn-primary h-8 text-xs">
        <Plus className="w-3.5 h-3.5" />
        Add first step
      </button>
    </div>
  );
}
