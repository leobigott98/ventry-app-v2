import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PushSettings } from "@/components/pwa/push-settings";

const push = vi.hoisted(() => ({ settings: vi.fn(), enable: vi.fn() }));
vi.mock("@/lib/push/browser", () => ({
  supportsPush: () => true, isAppleMobile: () => false,
  readPushDevice: () => null, readPushSettings: push.settings, enableDevicePush: push.enable,
}));

afterEach(() => vi.unstubAllGlobals());

describe("Preferencias de notificaciones", () => {
  it("explica los avisos antes del permiso y mantiene el fallback al rechazarlo", async () => {
    const requestPermission = vi.fn().mockResolvedValue("denied");
    vi.stubGlobal("Notification", { permission: "default", requestPermission });
    push.settings.mockResolvedValue({ publicKey: "key", preferences: {}, deviceStatus: null });

    render(<PushSettings owner="resident" kinds={["visit_waiting"]} />);
    const activate = await screen.findByRole("button", { name: "Activar notificaciones" });
    expect(requestPermission).not.toHaveBeenCalled();
    expect(screen.getByText(/Siempre puedes consultar los avisos en Ventry/)).toBeInTheDocument();
    await userEvent.click(activate);
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(push.enable).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Puedes seguir consultando tus avisos en Ventry.");
    expect(screen.getByRole("checkbox", { name: "Visita esperando confirmación" })).toBeEnabled();
  });
});
