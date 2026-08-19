import { redirect } from "next/navigation";

import { ResidentContacts } from "@/components/resident/resident-auxiliary-pages";
import { getFrequentVisitorContacts } from "@/lib/domain/invitations";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }

export default async function ContactsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { context, sessionUser } = await getCommunityContextOrRedirect({ allowedRoles: ["resident"] });
  if (!sessionUser.residentId) redirect("/app");
  const params = await searchParams;
  const contacts = await getFrequentVisitorContacts(context.community.id, sessionUser.residentId, 20);
  return <ResidentContacts contacts={contacts} query={single(params.q)} />;
}
