import type { EvidenceRef } from "../../lib/types";
import { Badge, Card } from "../ui/Primitives";

const ROLE_TONES: Record<string, "info" | "accent" | "neutral" | "warn"> = {
  documentation: "info",
  source: "accent",
  config: "warn",
  test: "neutral",
  other: "neutral",
};

export function CodeSnippet({ lines, highlight }: { lines: string[]; highlight?: { from: number; to: number } }) {
  const start = highlight?.from ?? 1;
  return (
    <div className="scroll-region overflow-x-auto rounded-control border border-line bg-canvas">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, index) => {
            const number = start + index;
            const marked = highlight ? number >= highlight.from && number <= highlight.to : false;
            return (
              <tr key={`${number}-${index}`} className={marked ? "bg-warn-soft/70" : undefined}>
                <td className="w-12 select-none border-r border-line px-2 py-[3px] text-right align-top font-mono text-2xs text-ink-faint">
                  {number}
                </td>
                <td className="px-3 py-[3px] align-top">
                  <span className="code-line text-ink/90">{line || " "}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function EvidencePane({ item }: { item: EvidenceRef }) {
  const lines = item.excerpt.split("\n");
  const highlight =
    item.start_line !== null && item.end_line !== null
      ? { from: item.start_line, to: item.end_line }
      : undefined;
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Badge tone={ROLE_TONES[item.role] ?? "neutral"}>{item.role}</Badge>
          <span className="truncate font-mono text-2xs text-ink-muted" title={item.path}>
            {item.path}
          </span>
        </div>
        <span className="font-mono text-2xs text-ink-faint">
          {item.start_line !== null
            ? `L${item.start_line}${
                item.end_line && item.end_line !== item.start_line ? `–${item.end_line}` : ""
              }`
            : "no line info"}
        </span>
      </div>
      <div className="bg-surface p-2.5">
        <CodeSnippet lines={lines} highlight={highlight} />
      </div>
    </Card>
  );
}

export function EvidenceList({ evidence }: { evidence: EvidenceRef[] }) {
  if (!evidence.length) {
    return (
      <div className="rounded-panel border border-dashed border-line-strong bg-surface px-4 py-8 text-center text-[13px] text-ink-muted">
        No file evidence is attached to this finding.
      </div>
    );
  }
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {evidence.map((item, index) => (
        <EvidencePane key={`${item.path}-${item.start_line}-${index}`} item={item} />
      ))}
    </div>
  );
}