# RepoScribe demo guide

Goal: show, in under three minutes, one real documentation defect, the evidence behind it, and a patch you
can verify. Every number below comes from the bundled sample repository.

## 1. Start the app

Run these in two terminals from the repository root.

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

```powershell
cd frontend
npm run dev
```

Open <http://localhost:5173>. If the page does not load, use the setup steps in the [README](../README.md).
Before you present, check these two things:

- The landing page shows the **local demo mode** badge. Leave it visible.
- `GET /api/v1/health` returns `status: ok`.

## 2. The story in one sentence

> RepoScribe finds a documentation claim that no longer matches the code, shows the exact evidence, proposes a
> minimal repair, validates it, and leaves the final decision to the developer.

## 3. Click path

| # | Do this | You should see | Say this |
|---|---|---|---|
| 1 | Open the landing page | The local demo mode badge and **Try sample repository** | "RepoScribe checks whether the docs still match the code." |
| 2 | Click **Try sample repository** | Overview: 8 files, 2 documentation files, 2 routes | "It read the files and parsed the routes. It did not run any repository code." |
| 3 | Click **Run audit** | Findings list: 10 findings (6 verified, 4 needs review) | "Six deterministic checks ran. No model was needed." |
| 4 | Open the first **high / verified** route finding (documentation file: `docs/api.md`, claim: `GET /api/users`) | Evidence pane: the `docs/api.md` table row, the `APIRouter(prefix="/api/v2")` line, and the route decorator, each with a file and line | "This is verified, not guessed. Every claim has a source." |
| 5 | Point at **Limitations** | Caveats such as "dynamic routes are not compared as verified" | "It also tells you what it cannot see." |
| 6 | Click **Generate fix** | A diff that changes one row of `docs/api.md`; the `DELETE` row beside it is untouched | "One claim, one line. The neighbouring route is left for its own finding." |
| 7 | Click **Validate patch** | Six validation steps, all passed | "Validation re-runs every check before and after the patch. This finding is gone, and the patch introduced no new one. It is not proof that every sentence is correct." |
| 8 | Click **Download patch** (or **Download updated file**) | A downloadable `.patch` or fixed `.md` file | "Your repository is never modified." |
| 9 | Open **Ask RepoScribe** and ask "Which endpoints does this service expose?" | A short answer with citations and a demo-mode note | "Answers come only from retrieved excerpts. Citations are checked." |
| 10 | Open **Settings** | Provider status, workspace, delete control | "Secrets stay on the server. You can delete the workspace here." |
| 11 | Close | — | "Evidence first, minimal patches, and a final decision that stays with you." |

## 4. What the 10 findings are

| Status | Count | What it means in the sample |
|---|---|---|
| `verified` | 4 | README and `docs/api.md` document `/api/users`, but the code exposes `/api/v2/users` |
| `verified` | 1 | README references `scripts/seed.py`, which does not exist |
| `verified` | 1 | README links to `docs/setup.md`, which does not exist |
| `needs_review` | 2 | `REDIS_URL` is documented but not defined in `.env.example` or the source |
| `needs_review` | 1 | `app.settings.load_settings_legacy` is documented but not in the index |
| `needs_review` | 1 | The sample has no `LICENSE` file |

Status shows how strong the evidence is. Severity shows impact. A `needs_review` finding is a suggestion, not
a proven defect.

## 5. Three things not to say

- Do not hide or rename the local demo mode badge.
- Do not say validation proves the documentation is correct. It proves one finding no longer reproduces.
- Do not call this a published release or claim benchmark numbers that were not measured.

## 6. If a step goes wrong

- **API is not running:** deterministic checks need only the backend. Start it, reload, and rerun the audit.
- **The audit is empty:** open **Limitations** and read which checks or files were skipped, and why.
- **The provider is unavailable:** say so, and show the real provider state in **Settings**. Deterministic
  findings still work.
- **Numbers differ from this guide:** trust the screen, and check that you are on the bundled sample.
  Never claim a run passed that you did not see pass.
