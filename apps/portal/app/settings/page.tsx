"use client";

import { AppShell } from "@/components/AppShell";
import { resetAll } from "@/lib/storage";

export default function SettingsPage() {
  return (
    <AppShell title="Settings" subtitle="Tenant, environments, and demo controls">
      <div className="max-w-3xl mx-auto p-8 space-y-6">
        <Section title="Tenant">
          <Row label="Organization" value="Acme Lending" />
          <Row label="Default environment" value="Sandbox" />
          <Row label="Region" value="US" />
        </Section>

        <Section title="AI defaults">
          <Row label="Default model" value="claude-opus-4-7" />
          <Row label="PII redaction policy" value="strict (SSN, DOB, account numbers redacted)" />
          <Row label="Per-tenant key" value="team-key (shared)" />
        </Section>

        <Section title="Demo controls">
          <div className="p-4">
            <p className="text-sm text-ink-700 mb-3">
              This portal stores workflows and connections in your browser&apos;s
              localStorage. Reset to restore the demo data.
            </p>
            <button
              onClick={() => {
                resetAll();
                window.location.href = "/";
              }}
              className="btn-secondary"
            >
              Reset demo data
            </button>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-2.5 bg-ink-50 border-b border-ink-200">
        <span className="text-xs font-semibold text-ink-700">{title}</span>
      </div>
      <div className="divide-y divide-ink-200">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <span className="text-xs text-ink-500">{label}</span>
      <span className="text-sm text-ink-900 font-medium">{value}</span>
    </div>
  );
}
