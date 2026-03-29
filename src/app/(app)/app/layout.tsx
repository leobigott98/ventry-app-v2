import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentAppUserOrRedirect } from "@/lib/domain/session-context";

export default async function ProtectedAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const currentUser = await getCurrentAppUserOrRedirect();

  return <AppShell currentUser={currentUser}>{children}</AppShell>;
}
