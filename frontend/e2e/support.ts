import fs from "node:fs";
import path from "node:path";

/**
 * Playwright runs with `frontend/` as the working directory (see the npm
 * scripts). Keeping generated fixtures under the frontend keeps the repository
 * root clean and makes the paths identical locally and in CI.
 */
export const GENERATED_DIR = path.resolve(process.cwd(), "e2e", ".generated");
export const STORAGE_STATE = path.join(GENERATED_DIR, "storage-state.json");
export const FIXTURES_FILE = path.join(GENERATED_DIR, "fixtures.json");

export interface E2EFixtures {
  repository: {
    id: string;
    name: string;
  };
  audit: {
    id: string;
    findings: number;
  };
  finding: {
    id: string;
    title: string;
    check_id: string;
    status: string;
  };
  patch: {
    id: string;
    target_path: string;
  };
}

export function readFixtures(): E2EFixtures {
  const raw = fs.readFileSync(FIXTURES_FILE, "utf8");
  return JSON.parse(raw) as E2EFixtures;
}
