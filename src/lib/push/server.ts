import "server-only";

import { createECDH, createHash } from "node:crypto";
import { Pool } from "pg";
import { sendNotification } from "web-push";

import { notificationCopy, notificationHref, type NotificationKind } from "@/lib/push/notifications";

export function buildNativePayload(event: { id: string; kind: NotificationKind }) {
  return { id: event.id, href: notificationHref(event.id), ...notificationCopy[event.kind] };
}

export function getPushConfiguration() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  const databaseUrl = process.env.PUSH_DATABASE_URL;
  if (!publicKey || !privateKey || !subject || !databaseUrl) return null;

  try {
    const url = new URL(subject);
    if (!((url.protocol === "mailto:" && url.pathname.includes("@")) ||
          (url.protocol === "https:" && url.hostname !== "localhost" && !url.username && !url.password))) return null;
    const curve = createECDH("prime256v1");
    curve.setPrivateKey(Buffer.from(privateKey, "base64url"));
    if (curve.getPublicKey().toString("base64url") !== publicKey) return null;
  } catch {
    return null;
  }

  return { publicKey, privateKey, subject, databaseUrl };
}

export function allowedPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    const host = url.hostname;
    return endpoint.startsWith("https://" + host + "/") && !url.hash &&
      (host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com" ||
       /^[a-z0-9-]+\.(push\.apple\.com|notify\.windows\.com)$/.test(host));
  } catch {
    return false;
  }
}

type Delivery = {
  delivery_id: string;
  lease_id: string;
  event_id: string;
  kind: NotificationKind;
  ttl: number;
  endpoint: string;
  p256dh: string;
  auth_secret: string;
};

let pool: Pool | undefined;

function deliveryResult(error: unknown) {
  const status = typeof error === "object" && error && "statusCode" in error ? error.statusCode : undefined;
  if (status === 404 || status === 410) return "expired";
  if (typeof status !== "number" || status === 429 || status >= 500) return "retry";
  return "failed";
}

export async function deliverQueuedPush(eventId?: string) {
  const config = getPushConfiguration();
  if (!config) return null;

  pool ??= new Pool({
    connectionString: config.databaseUrl,
    max: 3,
    connectionTimeoutMillis: 3500,
    statement_timeout: 4000,
    idleTimeoutMillis: 10000,
  }).on("error", () => console.warn("Se perdió una conexión inactiva del worker push."));
  const database = pool;
  const { rows } = await database.query<Delivery>(
    "select * from ventry_push.claim_deliveries($1, $2)",
    [config.publicKey, eventId ?? null],
  );
  const outcomes = await Promise.all(rows.map(async (delivery) => {
    let result = "failed";
    if (allowedPushEndpoint(delivery.endpoint)) {
      try {
        await sendNotification(
          { endpoint: delivery.endpoint, keys: { p256dh: delivery.p256dh, auth: delivery.auth_secret } },
          JSON.stringify(buildNativePayload({ id: delivery.event_id, kind: delivery.kind })),
          {
            TTL: delivery.ttl,
            urgency: delivery.kind === "call_incoming" || delivery.kind === "visit_waiting" ? "high" : "normal",
            topic: createHash("sha256").update(delivery.event_id).digest("base64url").slice(0, 32),
            timeout: 7000,
            vapidDetails: { publicKey: config.publicKey, privateKey: config.privateKey, subject: config.subject },
          },
        );
        result = "sent";
      } catch (error) {
        result = deliveryResult(error);
      }
    }
    await database.query("select ventry_push.finish_delivery($1, $2, $3)", [
      delivery.delivery_id, delivery.lease_id, result,
    ]);
    return result;
  }));
  if (!eventId) await database.query("select ventry_push.prune()");
  return { claimed: rows.length, sent: outcomes.filter((result) => result === "sent").length, retrying: outcomes.includes("retry") };
}
