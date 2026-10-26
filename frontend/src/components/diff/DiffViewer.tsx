import { cn, VALIDATION_LABELS } from "../../lib/format";
import type { ValidationResult } from "../../lib/types";
import { Badge, Card } from "../ui/Primitives";

export function DiffViewer({ diff }: { diff: string }) {
  if (!diff.trim()) {
    return <Card className="px-4 py-6 text-center text-[13px] text-ink-muted">The proposed change is empty.</Card>;
  }
  const lines = diff.split("\n");
  return (
    <div className="scroll-region overflow-x-auto rounded-panel border border-line bg-canvas">
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
                  isAdd && "border-l-ok/40 bg-ok-soft",
                  isRemove && "border-l-danger/40 bg-danger-soft",
                  (isHunk || isFile) && "bg-subtle",
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
                            : "text-ink/80",
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
  );
}

const OUTCOME_TONES: Record<string, "ok" | "danger" | "neutral" | "warn"> = {
  passed: "ok",
  failed: "danger",
  not_run: "neutral",
  inconclusive: "warn",
};

const OUTCOME_DOTS: Record<string, string> = {
  passed: "bg-ok",
  failed: "bg-danger",
  not_run: "bg-ink-faint",
  inconclusive: "bg-warn",
};

export function ValidationChecklist({ result }: { result: ValidationResult | null }) {
  if (!result) {
    return (
      <Card className="px-4 py-5">
        <p className="text-[13px] leading-6 text-ink-muted">
          Validation has not run. A patch is only marked passed after the checks below complete against the
          indexed snapshot.
        </p>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h3 className="text-[13px] font-semibold text-ink">Validation</h3>
        <Badge tone={OUTCOME_TONES[result.outcome]}>{VALIDATION_LABELS[result.outcome]}</Badge>
      </div>
      <ul className="divide-y divide-line">
        {result.steps.map((step) => (
          <li key={step.id} className="flex items-start gap-3 px-4 py-2.5">
            <span className="mt-[3px] font-mono text-2xs text-ink-faint">{step.id}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-ink">{step.label}</p>
              <p className="mt-0.5 text-2xs leading-4 text-ink-muted">{step.detail}</p>
            </div>
            <Badge tone={OUTCOME_TONES[step.outcome]}>
              <span aria-hidden="true" className={cn("h-1 w-1 rounded-full", OUTCOME_DOTS[step.outcome])} />
              {VALIDATION_LABELS[step.outcome]}
            </Badge>
          </li>
        ))}
      </ul>
      <div className="border-t border-line bg-subtle px-4 py-3 text-2xs leading-5 text-ink-muted">
        Validation checks the proposed documentation against the currently indexed repository. It does not
        guarantee that every semantic claim is correct.
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
      <span className="mx-1.5 text-line-strong">/</span>
      <span className="text-ok">+{added}</span> <span className="text-danger">−{removed}</span>
    </span>
  );
}