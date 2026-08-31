import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { findOrCreateResidentContact, residentContactIdsBelongToResident } from "@/lib/domain/contacts";
import { createResidentEvent } from "@/lib/domain/events";
import { createEventSchema } from "@/lib/schemas/events";
import { logOperationError } from "@/lib/server/operation-error";

export async function POST(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["admin", "resident"]);
  if ("response" in auth) return auth.response;

  const parsed = createEventSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }

  const residentId =
    auth.sessionUser.role === "resident" ? auth.sessionUser.residentId : parsed.data.residentId;
  if (!residentId) {
    return NextResponse.json(
      { error: "Tu usuario no tiene un residente vinculado." },
      { status: 403 },
    );
  }

  try {
    if (auth.sessionUser.role === "resident" && !await residentContactIdsBelongToResident(
      auth.context.community.id,
      residentId,
      parsed.data.guests.map((guest) => guest.residentContactId),
    )) {
      return NextResponse.json({ error: "Uno de los contactos seleccionados no está disponible." }, { status: 400 });
    }
    const event = await createResidentEvent(auth.context.community.id, {
      ...parsed.data,
      residentId,
    });
    let contactWarning = false;
    if (auth.sessionUser.role === "resident" && parsed.data.saveNewContacts) {
      const results = await Promise.allSettled(parsed.data.guests.filter((guest) => !guest.residentContactId).map((guest) => findOrCreateResidentContact(auth.context.community.id, residentId, {
        name: guest.fullName,
        phone: guest.phone,
        relationshipLabel: null,
        isFavorite: false,
        source: "manual",
      })));
      contactWarning = results.some((result) => result.status === "rejected");
    }
    return NextResponse.json({
      ok: true,
      eventId: event.id,
      warning: contactWarning ? "El evento se creó, pero algunos contactos no pudieron guardarse." : undefined,
      redirectTo: `/app/events/${event.id}${contactWarning ? "?contactWarning=1" : ""}`,
    });
  } catch (error) {
    logOperationError("create_resident_event", error);
    return NextResponse.json(
      { error: "No fue posible crear el evento. Revisa los datos e intenta nuevamente." },
      { status: 500 },
    );
  }
}
