import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("authentication and credential boundaries", () => {
  it("keeps the service-role secret in the server-only admin module", () => {
    const adminSource = read("src/lib/supabase/admin.ts");
    const sourceFiles = readdirSync(resolve(process.cwd(), "src"), {
      recursive: true,
      withFileTypes: true,
    })
      .filter(
        (entry) =>
          entry.isFile() && /\.[jt]sx?$/.test(entry.name) && !entry.name.includes(".test."),
      )
      .map((entry) => resolve(entry.parentPath, entry.name));
    const secretReferences = sourceFiles.filter((file) =>
      readFileSync(file, "utf8").includes("SUPABASE_SERVICE_ROLE_KEY"),
    );

    expect(adminSource).toContain('import "server-only"');
    expect(secretReferences).toEqual([resolve(process.cwd(), "src/lib/supabase/admin.ts")]);
  });

  it("validates guard credentials through narrow RPCs and never returns raw credential rows", () => {
    const guardsSource = read("src/lib/domain/guards.ts");
    const eventsSource = read("src/lib/domain/events.ts");

    expect(guardsSource).toContain('"match_invitation_credential"');
    expect(guardsSource).not.toContain('.from("access_credentials")');
    expect(eventsSource).toContain('"match_event_credential"');
    expect(eventsSource).not.toContain("event_credentials!inner");
  });

  it("does not persist raw submitted credentials in validation audit details", () => {
    const mutationsSource = read("src/lib/domain/mutations.ts");
    const eventAccessSource = read("src/lib/domain/event-access.ts");
    const auditFunction = mutationsSource.slice(
      mutationsSource.indexOf("export async function logCredentialValidationAttempt"),
      mutationsSource.indexOf("export async function registerInvitationEntry"),
    );

    expect(auditFunction).not.toContain("credentialValue");
    expect(eventAccessSource.slice(eventAccessSource.indexOf("export async function logAccessCredentialAttempt"))).not.toContain(
      "credentialValue",
    );
  });
});
