import { redirect } from "next/navigation";

import { ResidentContactsManager } from "@/components/resident/resident-contacts-manager";
import { getResidentContactViews } from "@/lib/domain/contacts";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function ContactsPage() {
  const { context, sessionUser } = await getCommunityContextOrRedirect({ allowedRoles: ["resident"] });
  if (!sessionUser.residentId) redirect("/app");
  const contacts = await getResidentContactViews(context.community.id, sessionUser.residentId, 1, 50);
  return <ResidentContactsManager initialContacts={contacts.items} initialTotal={contacts.total} timeZone={context.community.time_zone} />;
}
