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

  it("scopes manual guard entries to the authenticated community and makes them idempotent", () => {
    const mutations = read("src/lib/domain/mutations.ts");
    const unannouncedRoute = read("src/app/api/guards/unannounced/route.ts");
    const vehicleRoute = read("src/app/api/guards/vehicle/route.ts");

    expect(mutations).toContain('.eq("community_id", args.communityId)');
    expect(mutations).toContain("El residente seleccionado no pertenece a esta comunidad.");
    expect(mutations).toContain("idempotency_key: args.idempotencyKey");
    expect(unannouncedRoute).toContain('request.headers.get("Idempotency-Key")');
    expect(vehicleRoute).toContain('request.headers.get("Idempotency-Key")');
  });

  it("does not expose internal errors from guard API responses", () => {
    const guardRoutes = [
      "src/app/api/guards/entries/route.ts",
      "src/app/api/guards/event-entries/route.ts",
      "src/app/api/guards/invitation-search/route.ts",
      "src/app/api/guards/unannounced/route.ts",
      "src/app/api/guards/vehicle/route.ts",
      "src/app/api/guards/entries/[entryId]/exit/route.ts",
      "src/app/api/guards/validate-credential/route.ts",
    ].map(read).join("\n");

    expect(guardRoutes).not.toContain("error instanceof Error ? error.message");
  });

  it("keeps paginated invitation and access-log queries scoped before applying ranges", () => {
    const invitations = read("src/lib/domain/invitations.ts");
    const accessLog = read("src/lib/domain/access-log.ts");
    expect(invitations).toContain('.eq("community_id", communityId)');
    expect(invitations).toContain('.eq("resident_id", residentId)');
    expect(invitations).toContain(".range(from, to)");
    expect(accessLog).toContain('.eq("community_id", communityId)');
    expect(accessLog).toContain('query = query.eq("resident_id", filters.residentId)');
    expect(accessLog).toContain(".range(pagination.from, pagination.to)");
  });

  it("loads an invitation detail directly without querying unrelated invitations", () => {
    const detailPage = read("src/app/(app)/app/invitations/[invitationId]/page.tsx");
    expect(detailPage).toContain("getInvitationById");
    expect(detailPage).not.toContain("getPaginatedInvitations");
    expect(detailPage).not.toContain("switcherItems");
  });

  it("keeps planned event exit nullable, ordered and outside entry-window authorization", () => {
    const migration = read("supabase/migrations/202608200001_event_planned_exit.sql");
    const credentialMigration = read("supabase/migrations/202608180002_credential_security_atomic_access.sql");
    expect(migration).toContain("resident_events_planned_exit_pair_check");
    expect(migration).toContain("resident_events_planned_exit_after_window_check");
    expect(credentialMigration).toContain("now() < v_start_at or now() > v_end_at");
    expect(credentialMigration).not.toContain("planned_exit_date");
  });
});
