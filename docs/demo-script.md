# Demo script

Target: about two minutes, no dead ends, every number coming from a real run.

## Before recording

1. `cd backend` and start the API:
   `.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000`
2. `cd frontend` and start the UI: `npm run dev`, then open <http://localhost:5173>.
3. Confirm the landing page shows the **local demo mode** badge. Do not hide it or replace it with a "live"
   label.
4. Confirm `GET /api/v1/health` returns `status: ok`.
5. Rehearse twice. Do not record until the flow runs without a manual fix.

## Script

| Step | On screen | Say |
|---|---|---|
| 1 | Landing page | "Documentation drifts silently. RepoScribe finds the drift, shows the evidence, and prepares a repair you can verify." |
| 2 | Click **Try sample repository** | "This is a real FastAPI project with documentation defects planted in it." |
| 3 | Overview | "It inspected the files, indexed two documentation files and the Python source, and found the routes statically. It did not execute anything." |
| 4 | Click **Run audit** | "Six deterministic checks. No model needed for any of them." |
| 5 | Findings list | "Ten findings: route mismatches, a broken internal link, a missing file reference, undocumented configuration, a stale symbol, and one checklist suggestion. Severity is impact; status is how strong the evidence is." |
| 6 | Open a **high / verified** route finding | "This is verified, not guessed." |
| 7 | Evidence inspector | "Three pieces of evidence: the README table row that says `/api/users`, the `APIRouter(prefix='/api/v2')` line, and the decorator. Every one has a path and a line number." |
| 8 | Point at limitations | "It also tells you what it cannot see: dynamic route registration is reported as inconclusive, never as missing." |
| 9 | Click **Generate fix** | "The patch is minimal — one line in one document." |
| 10 | Diff view | "Before and after. Nothing else in the file changed." |
| 11 | Click **Validate patch** | "Validation reruns the check that produced the finding, re-resolves every internal link, and confirms referenced files and symbols still exist." |
| 12 | Validation checklist | "Six steps, all passed — and the page still says passing is not proof that every sentence is correct." |
| 13 | Click **Download updated file** | "You get the patch or the fixed Markdown. RepoScribe never touches your repository." |
| 14 | Switch to **Ask**, ask "Which endpoints does this service expose?" | "Answers are grounded in retrieved excerpts. Every citation is verified against evidence, and demo mode is labelled because no language model is configured." |
| 15 | Settings | "Provider status, workspace, and delete. Secrets stay server-side." |
| 16 | Close | "Small patches, real evidence, honest labels, and a repository you stay in control of." |

## The one sentence that matters

> RepoScribe finds a documentation claim that no longer matches the code, shows the exact evidence, proposes a
> minimal repair, validates it, and leaves the final decision to the developer.

## If something fails live

- Provider errors: deterministic checks still work — say so, and show the provider state in Settings.
- Audit looks empty: open **Scan limitations** and explain which files or checks were skipped, and why.
- Never claim a run passed that you did not see pass.