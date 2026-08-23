import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { createInvitationGroup } from "@/lib/domain/mutations";
import { findOrCreateResidentContact, linkInvitationToResidentContact, residentContactIdsBelongToResident } from "@/lib/domain/contacts";
import { createInvitationGroupSchema } from "@/lib/schemas/invitations";

export async function POST(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["admin", "resident"]);
  if ("response" in auth) return auth.response;
  const parsed = createInvitationGroupSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos invalidos." }, { status: 400 });
  const residentId = auth.sessionUser.role === "resident" ? auth.sessionUser.residentId : parsed.data.residentId;
  if (!residentId) return NextResponse.json({ error: "Tu usuario no tiene un residente vinculado." }, { status: 403 });
  try {
    if (auth.sessionUser.role === "resident" && !await residentContactIdsBelongToResident(
      auth.context.community.id,
      residentId,
      parsed.data.visitors.map((visitor) => visitor.residentContactId),
    )) {
      return NextResponse.json({ error: "Uno de los contactos seleccionados no está disponible." }, { status: 400 });
    }
    const group = await createInvitationGroup(auth.context.community.id, { ...parsed.data, residentId });
    let contactWarning = false;
    if (auth.sessionUser.role === "resident") {
      await Promise.all(parsed.data.visitors.map(async (visitor, index) => {
        const invitationId = group.invitationIds[index];
        if (!invitationId || (!visitor.residentContactId && !parsed.data.saveNewContacts)) return;
        try {
          const contactId = visitor.residentContactId ?? (await findOrCreateResidentContact(auth.context.community.id, residentId, {
            name: visitor.fullName, phone: visitor.phone, relationshipLabel: null, isFavorite: false, source: "manual",
          })).id;
          await linkInvitationToResidentContact(auth.context.community.id, residentId, invitationId, contactId);
        } catch { contactWarning = true; }
      }));
    }
    return NextResponse.json({ ok: true, groupId: group.groupId, invitationIds: group.invitationIds, warning: contactWarning ? "La invitación grupal se creó, pero algunos contactos no pudieron guardarse." : undefined, redirectTo: `/app/invitation-groups/${group.groupId}${contactWarning ? "?contactWarning=1" : ""}` });
  } catch {
    return NextResponse.json({ error: "No fue posible crear la invitacion grupal. Revisa los datos e intenta nuevamente." }, { status: 500 });
  }
}
