"use client";

import type { ComponentProps } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

type LogoutButtonProps = Omit<ComponentProps<typeof Button>, "children" | "onClick"> & {
  label?: string;
  onLoggedOut?: () => void;
};

export function LogoutButton({
  label = "Cerrar sesion",
  onLoggedOut,
  disabled,
  ...props
}: LogoutButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    setIsPending(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
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
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
