import { GuardWorkspace } from "@/components/guards/guard-workspace";
import { GuardUpcomingAccess } from "@/components/guards/guard-upcoming-access";
import { getResidentsForCommunity } from "@/lib/domain/community";
import {
  getOpenEntriesForCommunity,
  getRecentAccessEvents,
  getRecentGuardInvitations,
  getGuardUpcomingAccess,
} from "@/lib/domain/guards";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function GuardsPage() {
  const { context } = await getCommunityContextOrRedirect({ allowedRoles: ["admin", "guard"] });
  const [residents, recentInvitations, openEntries, recentEvents, upcoming] = await Promise.all([
    getResidentsForCommunity(context.community.id),
    getRecentGuardInvitations(context.community.id),
    getOpenEntriesForCommunity(context.community.id),
    getRecentAccessEvents(context.community.id),
    getGuardUpcomingAccess(context.community.id, { page: 1, pageSize: 3 }),
  ]);

  return (
    <div className="space-y-5">
      <GuardWorkspace
        communityName={context.community.name}
        openEntries={openEntries}
        recentEvents={recentEvents}
        recentInvitations={recentInvitations}
        residents={residents.filter((resident) => resident.is_active).map(({ id, full_name, units }) => ({
          id, full_name, units,
        }))}
      />
      <GuardUpcomingAccess initial={upcoming} />
    </div>
  );
}
