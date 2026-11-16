import type { PreferenceKind } from "@/lib/push/notifications";

const storageKey = "ventry:push-device";

type Device = { id: string; owner: string };
export type PushSettingsState = {
  publicKey: string | null;
  preferences: Partial<Record<PreferenceKind, boolean>>;
  deviceStatus: "active" | "expired" | "disabled" | null;
};

export function readPushDevice(): Device | null {
  try {
    const device = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    return typeof device?.id === "string" && typeof device?.owner === "string" ? device : null;
  } catch {
    return null;
  }
}

export function rememberPushDevice(device: Device | null) {
  if (device) localStorage.setItem(storageKey, JSON.stringify(device));
  else localStorage.removeItem(storageKey);
}

export function supportsPush() {
  return window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function isAppleMobile() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export async function readPushSettings(installationId?: string): Promise<PushSettingsState> {
  const query = installationId ? "?" + new URLSearchParams({ installationId }) : "";
  const response = await fetch("/api/push" + query, { cache: "no-store" });
  if (!response.ok) throw new Error("No pudimos cargar los ajustes de avisos.");
  return response.json();
}

export async function updatePushSettings(body: Record<string, unknown>) {
  const response = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "No pudimos guardar el cambio.");
  return data;
}

async function getRegistration() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (registration?.active) return registration;
  // Register on demand too, so enabling works immediately after opening settings.
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Ventry aún está preparando este dispositivo.")), 5000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  });
}

function keyMatches(key: ArrayBuffer | null, expected: Uint8Array) {
  return key !== null && key.byteLength === expected.length &&
    new Uint8Array(key).every((value, index) => value === expected[index]);
}

export async function enableDevicePush(device: Device, publicKey: string, replace: boolean, explicit = false) {
  const registration = await getRegistration();
  const key = Uint8Array.from(atob(publicKey.replace(/-/g, "+").replace(/_/g, "/") + "="), (char) => char.charCodeAt(0));
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && (replace || !keyMatches(subscription.options.applicationServerKey, key))) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  if (explicit) rememberPushDevice(device);
  else if (readPushDevice()?.id !== device.id) return;
  await updatePushSettings({
    action: "subscribe", installationId: device.id, publicKey, subscription: subscription.toJSON(),
    platform: isAppleMobile() ? "ios" : /Android/.test(navigator.userAgent) ? "android" : "web",
  });
}

export async function clearBrowserPush() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) return;
  const subscription = await registration.pushManager?.getSubscription();
  await Promise.all([
    subscription?.unsubscribe(),
    registration.getNotifications().then((items) => items.forEach((item) => item.close())),
  ]);
}
