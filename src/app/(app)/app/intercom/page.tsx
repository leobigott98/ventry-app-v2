import { IntercomUnavailable } from "@/components/resident/resident-auxiliary-pages";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function IntercomPage() {
  const { context } = await getCommunityContextOrRedirect({ allowedRoles: ["resident"] });
  return <IntercomUnavailable communityName={context.community.name} />;
}
