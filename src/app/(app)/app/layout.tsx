import type { ReactNode } from "react";

import { PushDeviceMaintenance } from "@/components/pwa/push-device-maintenance";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentAppUserOrRedirect } from "@/lib/domain/session-context";

export default async function ProtectedAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const currentUser = await getCurrentAppUserOrRedirect();

  return <AppShell currentUser={currentUser}>
    {currentUser.authUserId ? <PushDeviceMaintenance owner={currentUser.authUserId} /> : null}
    {children}
  </AppShell>;
}
