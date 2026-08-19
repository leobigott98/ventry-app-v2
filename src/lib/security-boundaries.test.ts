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

  it("validates guard credentials through the rate-limited RPC and never reads raw credential rows", () => {
    const guardsSource = read("src/lib/domain/guards.ts");
    const eventsSource = read("src/lib/domain/events.ts");
    const eventAccessSource = read("src/lib/domain/event-access.ts");

    expect(eventAccessSource).toContain('"validate_access_credential"');
    expect(guardsSource).not.toContain('.from("access_credentials")');
    expect(eventsSource).not.toContain("event_credentials!inner");
    expect(eventAccessSource).not.toContain("credential_secrets");
  });

  it("redacts historical audits and rejects future raw credential fields", () => {
    const migration = read(
      "supabase/migrations/202608180002_credential_security_atomic_access.sql",
    );
    expect(migration).toContain("redact_credential_audit_details");
    expect(migration).toContain("reject_raw_credential_audit");
    expect(migration).toContain("'credentialRef'");
    expect(migration).not.toContain("jsonb_build_object('pin'");
  });

  it("uses cryptographic PIN and opaque QR generation without tenant identifiers", () => {
    const generator = read("src/lib/security/credentials.ts");
    const mutations = read("src/lib/domain/mutations.ts");
    const events = read("src/lib/domain/events.ts");
    const source = `${generator}\n${mutations}\n${events}`;

    expect(generator).toContain("randomInt");
    expect(generator).toContain("randomBytes(32)");
    expect(source).not.toContain("Math.random");
    expect(source).not.toContain("`ventry:${communityId}");
    expect(source).not.toContain("`ventry:event:${communityId}");
  });

  it("keeps recoverable v2 secrets outside ordinary RLS and makes entry atomic/idempotent", () => {
    const migration = read(
      "supabase/migrations/202608180002_credential_security_atomic_access.sql",
    );
    expect(migration).toContain("revoke all on table public.credential_secrets from anon, authenticated");
    expect(migration).toContain("for update of invitation");
    expect(migration).toContain("for update of resident_event");
    expect(migration).toContain("idx_visitor_entries_community_idempotency");
    expect(migration).toContain("register_event_guest_entry");
  });
});
