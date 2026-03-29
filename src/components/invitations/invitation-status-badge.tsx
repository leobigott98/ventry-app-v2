import { Badge } from "@/components/ui/badge";
import {
  getInvitationStatusLabel,
  getInvitationStatusVariant,
} from "@/lib/domain/invitations";
import type { InvitationStatus } from "@/lib/domain/types";

export function InvitationStatusBadge({ status }: { status: InvitationStatus }) {
  return (
    <Badge variant={getInvitationStatusVariant(status)}>
      {getInvitationStatusLabel(status)}
    </Badge>
  );
}

