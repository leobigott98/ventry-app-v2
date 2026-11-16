"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  clearBrowserPush, enableDevicePush, isAppleMobile, readPushDevice, readPushSettings,
  rememberPushDevice, supportsPush, updatePushSettings, type PushSettingsState,
} from "@/lib/push/browser";
import { notificationCopy, type PreferenceKind } from "@/lib/push/notifications";

export function PushSettings({ owner, kinds }: { owner: string; kinds: readonly PreferenceKind[] }) {
  const [settings, setSettings] = useState<PushSettingsState | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [appleMobile, setAppleMobile] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      const canPush = supportsPush();
      setSupported(canPush);
      setAppleMobile(isAppleMobile());
      if (canPush) setPermission(Notification.permission);
      const local = readPushDevice();
      try {
        const next = await readPushSettings(local?.owner === owner ? local.id : undefined);
        if (mounted) setSettings(next);
      } catch {
        if (mounted) setMessage("No pudimos cargar los ajustes de avisos.");
      }
    }
    void load();
    const refresh = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [owner]);

  async function run(change: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await change();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos guardar el cambio.");
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    if (!settings?.publicKey) return;
    // The call to requestPermission must stay in the click gesture, before any await.
    const choice = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    setPermission(choice);
    if (choice !== "granted") {
      setMessage("Puedes seguir consultando tus avisos en Ventry.");
      return;
    }
    const local = readPushDevice();
    const own = local?.owner === owner;
    const device = own ? local : { id: crypto.randomUUID(), owner };
    await enableDevicePush(device, settings.publicKey, !own || settings.deviceStatus === "expired", true);
    setSettings({ ...settings, deviceStatus: "active" });
    setMessage("Avisos activados en este dispositivo.");
  }

  async function disable() {
    const local = readPushDevice();
    if (local?.owner !== owner || !settings) return;
    await updatePushSettings({ action: "disable", installationId: local.id });
    rememberPushDevice(null);
    await clearBrowserPush().catch(() => undefined);
    setSettings({ ...settings, deviceStatus: "disabled" });
    setMessage("Avisos desactivados en este dispositivo.");
  }

  async function test() {
    const local = readPushDevice();
    if (!local || local.owner !== owner) return;
    const result = await updatePushSettings({ action: "test", installationId: local.id });
    setMessage(result.status === "accepted"
      ? "El servicio push aceptó la prueba. Busca el aviso del sistema."
      : "La prueba quedó en cola. Busca el aviso del sistema en breve.");
  }

  const active = permission === "granted" && settings?.deviceStatus === "active";
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-4 sm:p-6">
      <h2 className="text-lg font-bold">Avisos en este dispositivo</h2>
      <p className="text-sm text-muted-foreground">
        Activa las notificaciones para enterarte de accesos y avisos de la garita aunque Ventry esté cerrado.
        El dispositivo controla el sonido y la vibración. Siempre puedes consultar los avisos en Ventry.
      </p>
      {supported === false ? <p className="text-sm text-muted-foreground">
        {appleMobile ? "En iPhone o iPad, añade Ventry a la pantalla de inicio desde Safari y ábrelo desde su icono."
          : "Abre Ventry mediante HTTPS en un navegador compatible con Web Push."}
      </p> : null}
      {supported && permission === "denied" ? <p className="text-sm">Habilita las notificaciones en los ajustes del navegador o del sistema para activarlas aquí.</p> : null}
      {settings && !settings.publicKey ? <p className="text-sm">El envío push aún no está configurado.</p> : null}
      {supported && permission !== "denied" && settings?.publicKey ? (
        <div className="flex flex-wrap gap-2">
          {active ? <>
            <Button type="button" disabled={busy} onClick={() => void run(test)}>Enviar prueba</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void run(disable)}>Desactivar este dispositivo</Button>
          </> : (
            <Button type="button" disabled={busy} onClick={() => void run(activate)}>
              {settings.deviceStatus === "expired" ? "Reactivar notificaciones" : "Activar notificaciones"}
            </Button>
          )}
        </div>
      ) : null}
      {settings ? <fieldset disabled={busy} className="space-y-2 border-t border-border pt-4">
        <legend className="px-1 text-sm font-semibold">Tipos de avisos push</legend>
        {kinds.map((kind) => (
          <label key={kind} className="flex min-h-10 items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-primary"
              checked={settings.preferences[kind] ?? true}
              onChange={(event) => {
                const enabled = event.target.checked;
                void run(async () => {
                  await updatePushSettings({ action: "preference", kind, enabled });
                  setSettings({ ...settings, preferences: { ...settings.preferences, [kind]: enabled } });
                });
              }}
            />
            {notificationCopy[kind].title}
          </label>
        ))}
      </fieldset> : null}
      <p role="status" className="text-sm">{message}</p>
    </section>
  );
}
