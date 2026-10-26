import { useState } from "react";
import { Link } from "react-router-dom";

import { useAppState } from "../../app/AppState";
import { api, ApiError } from "../../lib/api";
import { useShell } from "../../lib/shell";
import { Badge, Button, Card, ErrorNotice, PageHeader, Spinner } from "../../components/ui/Primitives";

const EXAMPLES = [
  "Which endpoints does this service expose?",
  "How is the application configured?",
  "What does the README tell a new contributor to run?",
  "Where are user routes defined?",
];

interface Exchange {
  question: string;
  answer?: Awaited<ReturnType<typeof api.ask>>;
  error?: ApiError;
}

export default function AskPage() {
  const { repository } = useShell();
  const { provider } = useAppState();
  const [question, setQuestion] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [pending, setPending] = useState(false);

  async function submit(text: string) {
    const asked = text.trim();
    if (!asked || pending) return;
    setQuestion("");
    setPending(true);
    const index = exchanges.length;
    setExchanges((current) => [...current, { question: asked }]);
    try {
      const answer = await api.ask(repository.id, asked);
      setExchanges((current) =>
        current.map((item, position) => (position === index ? { ...item, answer } : item)),
      );
    } catch (caught) {
      setExchanges((current) =>
        current.map((item, position) => (position === index ? { ...item, error: caught as ApiError } : item)),
      );
    } finally {
      setPending(false);
    }
  }

  const providerUnavailable = provider?.mode === "unavailable";

  return (
    <div>
      <PageHeader
        title="Ask RepoScribe"
        subtitle="Answers are limited to the inspected snapshot. Every citation points at a real retrieved excerpt."
        actions={
          provider ? (
            <Badge tone={provider.mode === "live" ? "ok" : providerUnavailable ? "danger" : "info"}>
              {provider.mode === "live" ? "live provider" : providerUnavailable ? "provider unavailable" : "local demo mode"}
            </Badge>
          ) : null
        }
      />

      <div className="space-y-6 p-6">
        <Card className="p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit(question);
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <label htmlFor="question" className="sr-only">
              Question about this repository
            </label>
            <input
              id="question"
              value={question}
              maxLength={500}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about routes, configuration, setup instructions…"
              className="h-9 flex-1 rounded-control border border-line bg-subtle px-3 text-[13px] text-ink transition-colors placeholder:text-ink-faint hover:border-line-strong focus:border-accent/70"
            />
            <Button type="submit" variant="primary" loading={pending} disabled={!question.trim()}>
              Ask
            </Button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => void submit(example)}
                className="rounded-full border border-line bg-subtle px-3 py-1 text-2xs text-ink-muted hover:border-line-strong hover:text-ink"
              >
                {example}
              </button>
            ))}
          </div>

          <p className="mt-3 text-2xs text-ink-faint">
            {providerUnavailable
              ? provider?.message
              : "Demo mode answers are extracted from retrieved file excerpts by rules. No language model is contacted."}
          </p>
        </Card>

        {!exchanges.length ? (
          <div className="rounded-panel border border-dashed border-line-strong bg-surface p-6 text-sm text-ink-muted">
            Ask a question to search the indexed snapshot. If nothing supports an answer, RepoScribe says so instead of
            guessing.
          </div>
        ) : null}

        <div className="space-y-4">
          {exchanges.map((exchange, index) => (
            <Card key={`${exchange.question}-${index}`} className="p-4">
              <p className="text-sm font-semibold text-ink">{exchange.question}</p>

              {!exchange.answer && !exchange.error ? (
                <p className="mt-3 flex items-center gap-2 text-2xs text-ink-muted">
                  <Spinner className="text-accent" /> Retrieving evidence…
                </p>
              ) : null}

              {exchange.error ? (
                <div className="mt-3">
                  <ErrorNotice error={exchange.error} onRetry={() => void submit(exchange.question)} />
                </div>
              ) : null}

              {exchange.answer ? (
                <div className="mt-3 space-y-3">
                  <pre className="whitespace-pre-wrap font-sans text-[13px] leading-6 text-ink">{exchange.answer.answer}</pre>

                  {exchange.answer.citations.length ? (
                    <div>
                      <p className="text-2xs font-medium uppercase tracking-wide text-ink-faint">Citations</p>
                      <ul className="mt-2 space-y-2">
                        {exchange.answer.citations.map((citation, citationIndex) => (
                          <li key={`${citation.path}-${citationIndex}`} className="rounded-control border border-line">
                            <details>
                              <summary className="cursor-pointer px-3 py-2 text-2xs text-ink">
                                <span className="font-mono">{citation.path}</span>
                                <span className="ml-2 text-ink-faint">
                                  L{citation.start_line}–{citation.end_line}
                                </span>
                              </summary>
                              <pre className="scroll-region overflow-x-auto border-t border-line bg-subtle px-3 py-2 font-mono text-2xs text-ink">
                                {citation.excerpt}
                              </pre>
                            </details>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-2xs text-warn">No retrieved evidence supported an answer to this question.</p>
                  )}

                  {exchange.answer.limitations.length ? (
                    <ul className="space-y-1 text-2xs text-ink-faint">
                      {exchange.answer.limitations.map((limitation, limitationIndex) => (
                        <li key={limitationIndex}>• {limitation}</li>
                      ))}
                    </ul>
                  ) : null}

                  {exchange.answer.follow_up_suggestions.length ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {exchange.answer.follow_up_suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => void submit(suggestion)}
                          className="rounded-full border border-line bg-subtle px-2.5 py-1 text-2xs text-ink-muted hover:text-ink"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </Card>
          ))}
        </div>

        <p className="text-2xs text-ink-faint">
          Repository text is treated as untrusted data. Instructions inside a README cannot change what RepoScribe is
          allowed to do.{" "}
          <Link to={`/r/${repository.id}/settings`} className="text-accent hover:underline">
            Review provider settings
          </Link>
        </p>
      </div>
    </div>
  );
}