import { redirect } from "next/navigation";

import { VoiceInvitation, VoiceInvitationUnavailable } from "@/components/invitations/voice-invitation";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";
import { voiceProviderConfigured } from "@/lib/voice/openai-providers";

export default async function VoiceInvitationPage() {
  const { sessionUser } = await getCommunityContextOrRedirect({ allowedRoles: ["resident"] });
  if (!sessionUser.residentId) redirect("/app");
  const providerAvailable = voiceProviderConfigured();
  return providerAvailable ? <VoiceInvitation providerAvailable residentId={sessionUser.residentId} /> : <VoiceInvitationUnavailable />;
}
