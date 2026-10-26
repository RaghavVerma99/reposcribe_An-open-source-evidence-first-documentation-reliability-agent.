import type { ReactNode } from "react";

import { cn, VALIDATION_LABELS } from "../../lib/format";
import type { ValidationResult } from "../../lib/types";
import { Badge, Card } from "../ui/Primitives";

const VALIDATION_ICONS: Record<string, ReactNode> = {
  passed: (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  ),
  failed: (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5" />
    </svg>
  ),
  inconclusive: (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M8 3v6M8 12.5h.01" />
    </svg>
  ),
  not_run: (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="8" cy="8" r="5" strokeDasharray="2.5 2.5" />
    </svg>
  ),
};

export function DiffViewer({ diff }: { diff: string }) {
  if (!diff.trim()) {
    return (
      <Card className="px-4 py-8 text-center text-[13px] text-ink-muted">
        The proposed change is empty.
      </Card>
    );
  }
  const lines = diff.split("\n");
  return (
    <div className="overflow-hidden rounded-panel border border-line bg-canvas hairline">
      <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-2.5">
        <span aria-hidden="true" className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#ff5f56]" />
          <span className="h-2 w-2 rounded-full bg-[#ffbd2e]" />
          <span className="h-2 w-2 rounded-full bg-[#27c93f]" />
        </span>
        <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          proposed diff
        </span>
      </div>
      <div className="scroll-region overflow-x-auto">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, index) => {
              const isAdd = line.startsWith("+") && !line.startsWith("+++");
              const isRemove = line.startsWith("-") && !line.startsWith("---");
              const isHunk = line.startsWith("@@");
              const isFile = line.startsWith("+++") || line.startsWith("---");
              return (
                <tr
                  key={index}
                  className={cn(
                    "border-l-2 border-l-transparent",
                    isAdd && "border-l-ok/45 bg-ok-soft/80",
                    isRemove && "border-l-danger/45 bg-danger-soft/80",
                    (isHunk || isFile) && "bg-subtle/70",
                  )}
                >
                  <td
                    className={cn(
                      "w-9 select-none py-[3px] pl-2 pr-1 text-center align-top font-mono text-2xs",
                      isAdd ? "text-ok" : isRemove ? "text-danger" : "text-ink-faint",
                    )}
                  >
                    {isAdd ? "+" : isRemove ? "−" : isHunk ? "@" : ""}
                  </td>
                  <td className="py-[3px] pr-4 align-top">
                    <span
                      className={cn(
                        "code-line",
                        isAdd
                          ? "text-ok"
                          : isRemove
                            ? "text-danger"
                            : isHunk || isFile
                              ? "text-ink-faint"
                              : "text-ink/85",
                      )}
                    >
                      {line || " "}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const OUTCOME_TONES: Record<string, "ok" | "danger" | "neutral" | "warn"> = {
  passed: "ok",
  failed: "danger",
  not_run: "neutral",
  inconclusive: "warn",
};

export function ValidationChecklist({ result }: { result: ValidationResult | null }) {
  if (!result) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-4 px-5 py-5">
        <div className="min-w-0">
          <p className="eyebrow">Validation</p>
          <p className="body-text mt-2 max-w-2xl">
            Validation has not run. A patch is only marked passed after the checks below complete
            against the indexed snapshot.
          </p>
        </div>
        <Badge tone="neutral">not run</Badge>
      </Card>
    );
  }
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2">
          <h3 className="text-h3 text-ink">Validation</h3>
          <Badge tone={OUTCOME_TONES[result.outcome]}>
            <span aria-hidden="true">{VALIDATION_ICONS[result.outcome]}</span>
            {VALIDATION_LABELS[result.outcome]}
          </Badge>
        </div>
        <span className="font-mono text-2xs text-ink-faint">
          {result.steps.length} step{result.steps.length === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="divide-y divide-line">
        {result.steps.map((step) => (
          <li key={step.id} className="flex items-start gap-3 px-5 py-3.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line bg-subtle text-ink-muted">
              <span aria-hidden="true" className="font-mono text-2xs">
                {step.id.replace("V-", "")}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-ink">{step.label}</p>
              <p className="mt-0.5 text-2xs leading-5 text-ink-muted">{step.detail}</p>
            </div>
            <Badge tone={OUTCOME_TONES[step.outcome]} className="mt-0.5 shrink-0">
              <span aria-hidden="true">{VALIDATION_ICONS[step.outcome]}</span>
              {VALIDATION_LABELS[step.outcome]}
            </Badge>
          </li>
        ))}
      </ul>
      <div className="border-t border-line bg-subtle px-5 py-3 text-2xs leading-5 text-ink-muted">
        Validation checks the proposed documentation against the currently indexed repository. It
        does not guarantee that every semantic claim is correct.
      </div>
    </Card>
  );
}

export function DiffSummary({ diff }: { diff: string }) {
  const lines = diff.split("\n");
  const added = lines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length;
  const removed = lines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length;
  const files = lines.filter((line) => line.startsWith("+++")).length;
  return (
    <span>
      {files} file{files === 1 ? "" : "s"} changed
      <span aria-hidden="true" className="mx-1.5 text-line-strong">
        ·
      </span>
      <span className="text-ok">+{added}</span> <span className="text-danger">−{removed}</span>
    </span>
  );
}
