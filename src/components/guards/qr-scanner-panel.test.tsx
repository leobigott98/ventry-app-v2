// @vitest-environment-options {"url":"https://garita.example.com"}
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QrScannerPanel } from "@/components/guards/qr-scanner-panel";
import { GuardWorkspace } from "@/components/guards/guard-workspace";

const zxingMocks = vi.hoisted(() => ({ scan: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams("action=qr"),
}));

vi.mock("@zxing/browser", () => ({
  BrowserQRCodeReader: class BrowserQRCodeReader {
    scan(...args: unknown[]) {
      return zxingMocks.scan(...args);
    }
  },
}));

describe("QrScannerPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("solicita la cámara trasera, entrega el QR y limpia el MediaStream", async () => {
    const user = userEvent.setup();
    const onDetected = vi.fn();
    const stopTrack = vi.fn();
    const stopControls = vi.fn();
    let scanCallback: ((result: { getText: () => string }) => void) | undefined;

    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream,
    );
    zxingMocks.scan.mockImplementation(
      (_video: HTMLVideoElement, callback: typeof scanCallback) => {
        scanCallback = callback;
        return { stop: stopControls };
      },
    );

    render(<QrScannerPanel disabled={false} onDetected={onDetected} />);
    await user.click(screen.getByRole("button", { name: "Abrir cámara" }));

    await waitFor(() => expect(zxingMocks.scan).toHaveBeenCalledOnce());
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ video: expect.objectContaining({ facingMode: { ideal: "environment" } }) }),
    );
    expect(await screen.findByText(/Apunta la cámara al QR/)).toBeInTheDocument();

    act(() => scanCallback?.({ getText: () => "  ventry:invitation:abc  " }));

    expect(onDetected).toHaveBeenCalledWith("ventry:invitation:abc");
    expect(stopControls).toHaveBeenCalledOnce();
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(screen.getByText(/QR leído y enviado/)).toBeInTheDocument();
  });

  it("explica cuando el navegador no soporta cámara", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });

    render(<QrScannerPanel disabled={false} onDetected={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Abrir cámara" }));

    expect(await screen.findByText(/no ofrece acceso a cámara/i)).toBeInTheDocument();
    expect(zxingMocks.scan).not.toHaveBeenCalled();
  });

  it("requiere un contexto seguro para abrir la cámara", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: false });

    render(<QrScannerPanel disabled={false} onDetected={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Abrir cámara" }));

    expect(await screen.findByText(/sólo está disponible por HTTPS/)).toBeInTheDocument();
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it("explica cómo recuperarse cuando se deniega el permiso", async () => {
    const user = userEvent.setup();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
      new DOMException("Permission denied", "NotAllowedError"),
    );

    render(<QrScannerPanel disabled={false} onDetected={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Abrir cámara" }));

    expect(await screen.findByText(/Permiso de cámara denegado/i)).toBeInTheDocument();
    expect(screen.getByText(/vuelve a intentar/i)).toBeInTheDocument();
  });

  it("detiene las pistas al desmontar una cámara activa", async () => {
    const user = userEvent.setup();
    const stopTrack = vi.fn();
    const stopControls = vi.fn();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream,
    );
    zxingMocks.scan.mockReturnValue({ stop: stopControls });

    const view = render(<QrScannerPanel disabled={false} onDetected={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Abrir cámara" }));
    await screen.findByText(/Apunta la cámara al QR/);
    view.unmount();

    expect(stopControls).toHaveBeenCalledOnce();
    expect(stopTrack).toHaveBeenCalledOnce();
  });

  it("libera el stream si el permiso se concede después de detener la cámara", async () => {
    const user = userEvent.setup();
    const stopTrack = vi.fn();
    let grantPermission!: (stream: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(
      new Promise((resolve) => { grantPermission = resolve; }),
    );
    const onDetected = vi.fn();
    render(<QrScannerPanel disabled={false} onDetected={onDetected} />);
    await user.click(screen.getByRole("button", { name: "Abrir cámara" }));
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledOnce());
    await user.click(screen.getByRole("button", { name: "Detener" }));
    await act(async () => grantPermission(
      { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream,
    ));

    expect(stopTrack).toHaveBeenCalledOnce();
    expect(zxingMocks.scan).not.toHaveBeenCalled();
    expect(onDetected).not.toHaveBeenCalled();
  });

  it("valida en el servidor el QR leído por la cámara de garita", async () => {
    const user = userEvent.setup();
    const stopTrack = vi.fn();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream,
    );
    let detect!: (result: { getText: () => string }) => void;
    zxingMocks.scan.mockImplementation((_video, callback) => {
      detect = callback;
      return { stop: vi.fn() };
    });
    let respond!: (response: Response) => void;
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((resolve) => { respond = resolve; }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<GuardWorkspace residents={[]} recentInvitations={[]} openEntries={[]} recentEvents={[]} />);
    await user.click(await screen.findByRole("button", { name: "Abrir cámara" }));
    await screen.findByText(/Apunta la cámara al QR/);
    act(() => {
      detect({ getText: () => "ventry:invitation:abc" });
      detect({ getText: () => "ventry:invitation:abc" });
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/api/guards/validate-credential", expect.objectContaining({
      body: JSON.stringify({ credentialType: "qr", credentialValue: "ventry:invitation:abc" }),
    }));
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(screen.queryByRole("region", { name: "Resultado de validación" })).not.toBeInTheDocument();

    respond(Response.json({ match: null, message: "QR no encontrado." }));
    expect(await screen.findByText("QR no encontrado.")).toBeInTheDocument();
    expect(screen.getByText("No autorizar acceso.")).toBeInTheDocument();
  });
});
