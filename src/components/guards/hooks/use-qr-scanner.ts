"use client";

import type { IScannerControls } from "@zxing/browser";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ScannerStatus } from "@/components/guards/guard-types";
import { normalizeQrCredential } from "@/lib/qr-credentials";

const idleMessage =
  "Lista para usar la cámara trasera. La cámara requiere HTTPS, salvo en localhost.";

function isLocalCameraOrigin() {
  return ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
}

function cameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Permiso de cámara denegado. Habilítalo para este sitio y vuelve a intentar.";
    }
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") {
      return "No encontramos una cámara compatible. Puedes pegar el código QR manualmente.";
    }
    if (error.name === "NotReadableError") {
      return "La cámara está siendo usada por otra aplicación. Ciérrala y vuelve a intentar.";
    }
  }
  return "No fue posible abrir la cámara. Puedes pegar el código QR manualmente.";
}

export function useQrScanner(onDetected: (credential: string) => void) {
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [message, setMessage] = useState(idleMessage);
  const [lastScannedValue, setLastScannedValue] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef(0);
  const mountedRef = useRef(true);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const release = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const stream = mediaStreamRef.current;
    stream?.getTracks().forEach((track) => track.stop());
    const video = videoRef.current;
    if (video && video.srcObject === stream) video.srcObject = null;
    mediaStreamRef.current = null;
  }, []);

  const stop = useCallback(
    (nextStatus: ScannerStatus = "idle", nextMessage = idleMessage) => {
      sessionRef.current += 1;
      release();
      if (mountedRef.current) {
        setStatus(nextStatus);
        setMessage(nextMessage);
      }
    },
    [release],
  );

  const start = useCallback(async () => {
    setLastScannedValue(null);

    if (!window.isSecureContext && !isLocalCameraOrigin()) {
      stop(
        "unsupported",
        "La cámara sólo está disponible por HTTPS. Abre la dirección segura o pega el código QR.",
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      stop(
        "unsupported",
        "Este navegador no ofrece acceso a cámara. Puedes pegar el código QR manualmente.",
      );
      return;
    }

    release();
    const session = sessionRef.current + 1;
    sessionRef.current = session;
    setStatus("starting");
    setMessage("Solicitando permiso y abriendo la cámara trasera…");

    const video = videoRef.current;
    if (!video) {
      setStatus("error");
      setMessage("No fue posible preparar la vista de cámara.");
      return;
    }

    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      if (sessionRef.current !== session) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          height: { ideal: 720 },
          width: { ideal: 1280 },
        },
      });
      if (sessionRef.current !== session) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      mediaStreamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      if (sessionRef.current !== session) return;

      const codeReader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 180,
        delayBetweenScanSuccess: 500,
      });
      const controls = codeReader.scan(video, (result) => {
        if (!result || sessionRef.current !== session) return;

        const credential = normalizeQrCredential(result.getText());
        if (!credential) return;

        setLastScannedValue(credential);
        stop("detected", "QR leído.");
        onDetectedRef.current(credential);
      });

      if (sessionRef.current !== session) {
        controls.stop();
        return;
      }

      controlsRef.current = controls;
      setStatus("active");
      setMessage("Apunta la cámara al QR. La entrada aún no está autorizada.");
    } catch (error) {
      if (sessionRef.current !== session) return;
      release();
      const denied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "SecurityError");
      setStatus(denied ? "denied" : "error");
      setMessage(cameraErrorMessage(error));
    }
  }, [release, stop]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sessionRef.current += 1;
      release();
    };
  }, [release]);

  return {
    lastScannedValue,
    message,
    start,
    status,
    stop,
    videoRef,
  };
}
