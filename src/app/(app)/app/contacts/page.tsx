import { redirect } from "next/navigation";

import { ResidentContactsManager } from "@/components/resident/resident-contacts-manager";
import { getResidentContacts } from "@/lib/domain/contacts";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function ContactsPage() {
  const { context, sessionUser } = await getCommunityContextOrRedirect({ allowedRoles: ["resident"] });
  if (!sessionUser.residentId) redirect("/app");
  const contacts = await getResidentContacts(context.community.id, sessionUser.residentId);
  return <ResidentContactsManager initialContacts={contacts} />;
}
