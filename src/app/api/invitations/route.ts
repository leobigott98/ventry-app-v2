import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { createInvitation } from "@/lib/domain/mutations";
import { findOrCreateResidentContact, linkInvitationToResidentContact, residentContactIdsBelongToResident } from "@/lib/domain/contacts";
import { createInvitationSchema } from "@/lib/schemas/invitations";

export async function POST(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["admin", "resident"]);
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = createInvitationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }

  try {
    const residentId =
      auth.sessionUser.role === "resident"
        ? auth.sessionUser.residentId
        : parsed.data.residentId;

    if (!residentId) {
      return NextResponse.json(
        { error: "Tu usuario no tiene un residente vinculado." },
        { status: 403 },
      );
    }

    if (auth.sessionUser.role === "resident" && !await residentContactIdsBelongToResident(
      auth.context.community.id,
      residentId,
      [parsed.data.residentContactId],
    )) {
      return NextResponse.json({ error: "El contacto seleccionado no está disponible." }, { status: 400 });
    }

    const invitation = await createInvitation(auth.context.community.id, {
      ...parsed.data,
      residentId,
      residentContactId:
        auth.sessionUser.role === "resident" ? parsed.data.residentContactId : null,
    });
    let contactWarning = false;
    if (auth.sessionUser.role === "resident" && parsed.data.saveContact && !parsed.data.residentContactId && parsed.data.visitorName) {
      try {
        const contact = await findOrCreateResidentContact(auth.context.community.id, residentId, {
          name: parsed.data.visitorName,
          phone: parsed.data.visitorPhone,
          relationshipLabel: null,
          isFavorite: false,
          source: "manual",
        });
        await linkInvitationToResidentContact(auth.context.community.id, residentId, invitation.id, contact.id);
      } catch {
        contactWarning = true;
      }
    }
    return NextResponse.json({
      ok: true,
      invitationId: invitation.id,
      warning: contactWarning ? "La invitación se creó, pero no pudimos guardar el contacto." : undefined,
      redirectTo: `/app/invitations/${invitation.id}${contactWarning ? "?contactWarning=1" : ""}`,
    });
  } catch {
    return NextResponse.json(
      { error: "No fue posible crear la invitación. Revisa los datos e intenta nuevamente." },
      { status: 500 },
    );
  }
}
