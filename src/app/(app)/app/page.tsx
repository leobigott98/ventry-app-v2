import { redirect } from "next/navigation";

import { getCurrentAppUserOrRedirect } from "@/lib/domain/session-context";
import { getDefaultAppRouteForRole } from "@/lib/auth/access";

export default async function AppIndexPage() {
  const currentUser = await getCurrentAppUserOrRedirect();
  redirect(getDefaultAppRouteForRole(currentUser.role));
}
