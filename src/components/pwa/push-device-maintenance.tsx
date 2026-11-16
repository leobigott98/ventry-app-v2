"use client";

import { useEffect } from "react";

import {
  clearBrowserPush, enableDevicePush, readPushDevice, readPushSettings, rememberPushDevice,
  supportsPush, updatePushSettings,
} from "@/lib/push/browser";

export function PushDeviceMaintenance({ owner }: { owner: string }) {
  useEffect(() => {
    if (!supportsPush()) return;
    let lastCheck = 0;
    let cancelled = false;
    async function reconcile() {
      const device = readPushDevice();
      if (!device || document.hidden || Date.now() - lastCheck < 60_000) return;
      lastCheck = Date.now();
      if (device.owner !== owner) {
        rememberPushDevice(null);
        await clearBrowserPush();
        return;
      }

      if (Notification.permission !== "granted") {
        await updatePushSettings({ action: "disable", installationId: device.id });
        rememberPushDevice(null);
        await clearBrowserPush();
        return;
      }

      const settings = await readPushSettings(device.id);
      if (!cancelled && settings.publicKey && (settings.deviceStatus === "active" || settings.deviceStatus === "expired")) {
        // On browsers that require a fresh gesture, the settings screen offers manual reactivation.
        await enableDevicePush(device, settings.publicKey, settings.deviceStatus === "expired");
      }
    }
    const check = () => { void reconcile().catch(() => undefined); };
    check();
    document.addEventListener("visibilitychange", check);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", check);
    };
  }, [owner]);
  return null;
}
