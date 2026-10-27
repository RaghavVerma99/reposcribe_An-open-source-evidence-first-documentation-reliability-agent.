import fs from "node:fs";

import { request as playwrightRequest, type APIResponse } from "@playwright/test";

import {
  FIXTURES_FILE,
  GENERATED_DIR,
  STORAGE_STATE,
  type E2EFixtures,
} from "./support";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:8000";

async function expectOk(response: APIResponse, label: string): Promise<unknown> {
  if (!response.ok()) {
    throw new Error(`${label} failed (${response.status()}): ${await response.text()}`);
  }
  return response.json();
}

export default async function globalSetup(): Promise<void> {
  fs.rmSync(GENERATED_DIR, { recursive: true, force: true });
  fs.mkdirSync(GENERATED_DIR, { recursive: true });

  const api = await playwrightRequest.newContext({ baseURL: BASE_URL });

  try {
    const repository = (await expectOk(
      await api.post("/api/v1/repositories", {
        multipart: { sample_id: "fastapi-users" },
      }),
      "Create sample repository",
    )) as { id: string; name: string };

    const audit = (await expectOk(
      await api.post(`/api/v1/repositories/${repository.id}/audits`),
      "Run sample audit",
    )) as {
      id: string;
      findings: Array<{
        id: string;
        title: string;
        check_id: string;
        status: string;
      }>;
    };

    // Pick the first finding that the deterministic demo provider can patch.
    // Patch generation is deliberately limited to documentation targets, so a
    // 422 here is expected for findings without a safe target.
    let finding: (typeof audit.findings)[number] | undefined;
    let patch: { id: string; target_path: string } | undefined;

    for (const candidate of audit.findings) {
      if (candidate.status === "resolved") continue;
      const response = await api.post(
        `/api/v1/repositories/${repository.id}/findings/${candidate.id}/patches`,
      );
      if (response.ok()) {
        finding = candidate;
        patch = (await response.json()) as { id: string; target_path: string };
        break;
      }
      if (response.status() !== 422) {
        throw new Error(
          `Create patch for ${candidate.id} failed (${response.status()}): ${await response.text()}`,
        );
      }
    }

    if (!finding || !patch) {
      throw new Error("No sample finding could produce a patch for the E2E suite.");
    }

    const fixtures: E2EFixtures = {
      repository: { id: repository.id, name: repository.name },
      audit: { id: audit.id, findings: audit.findings.length },
      finding: {
        id: finding.id,
        title: finding.title,
        check_id: finding.check_id,
        status: finding.status,
      },
      patch: { id: patch.id, target_path: patch.target_path },
    };

    fs.writeFileSync(FIXTURES_FILE, `${JSON.stringify(fixtures, null, 2)}\n`);
    await api.storageState({ path: STORAGE_STATE });

    process.stdout.write(
      `[e2e] seeded ${fixtures.audit.findings} findings for ${repository.name} ` +
        `(finding ${finding.id}, patch ${patch.id})\n`,
    );
  } finally {
    await api.dispose();
  }
}
