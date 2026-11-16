"use client";

import type { ComponentProps } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogOut } from "lucide-react";

import { clearBrowserPush, readPushDevice, rememberPushDevice } from "@/lib/push/browser";
import { Button } from "@/components/ui/button";

type LogoutButtonProps = Omit<ComponentProps<typeof Button>, "children" | "onClick"> & {
  label?: string;
  labelClassName?: string;
  onLoggedOut?: () => void;
};

export function LogoutButton({
  label = "Cerrar sesion",
  labelClassName,
  onLoggedOut,
  disabled,
  ...props
}: LogoutButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    setIsPending(true);

    try {
      const device = readPushDevice();
      if (device) rememberPushDevice(null);
      const cleanup = clearBrowserPush().catch(() => undefined);
      await fetch("/api/auth/logout", device ? {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installationId: device.id }),
      } : { method: "POST" });
      void cleanup;
      onLoggedOut?.();
      router.push("/login");
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button
      {...props}
      disabled={disabled || isPending}
      onClick={() => void handleLogout()}
      type={props.type ?? "button"}
    >
      {isPending ? (
        <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut aria-hidden="true" className="h-4 w-4" />
      )}
      <span className={labelClassName}>{label}</span>
    </Button>
  );
}
