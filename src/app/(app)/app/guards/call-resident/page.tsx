import { GuardResidentDirectory } from "@/components/guards/guard-resident-directory";
import { getResidentsForCommunity } from "@/lib/domain/community";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function GuardCallResidentPage() {
  const { context } = await getCommunityContextOrRedirect({ allowedRoles: ["admin", "guard"] });
  const residents = await getResidentsForCommunity(context.community.id);

  return (
    <GuardResidentDirectory
      communityName={context.community.name}
      residents={residents.filter((resident) => resident.is_active).map(({ id, full_name, units }) => ({
        id, full_name, units,
      }))}
    />
  );
}
