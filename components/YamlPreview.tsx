"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import type { Workflow } from "@/lib/types";
import { workflowToYaml } from "@/lib/yaml";

export function YamlPreview({ workflow }: { workflow: Workflow }) {
  const yaml = workflowToYaml(workflow);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(yaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="card overflow-hidden flex flex-col h-full">
      <div className="h-10 px-3 flex items-center justify-between border-b border-ink-200 bg-ink-50 shrink-0">
        <span className="text-xs font-semibold text-ink-700">workflow.yaml</span>
        <button onClick={copy} className="btn-ghost h-7 px-2 text-[11px]">
          {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
        </button>
      </div>
      <pre className="flex-1 overflow-auto text-[12px] leading-relaxed font-mono text-ink-800 bg-white p-4 whitespace-pre">
{yaml}
      </pre>
    </div>
  );
}
