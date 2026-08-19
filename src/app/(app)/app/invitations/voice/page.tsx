import { VoiceUnavailable } from "@/components/resident/resident-auxiliary-pages";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function VoiceInvitationPage() {
  await getCommunityContextOrRedirect({ allowedRoles: ["resident"] });
  return <VoiceUnavailable />;
}
