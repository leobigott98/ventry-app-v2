import { NextRequest, NextResponse } from "next/server";

import { requireApiAuthenticatedUser } from "@/lib/auth/api";
import {
  getCommunityContextForUserId,
  getMembershipForUserId,
} from "@/lib/domain/community";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuthenticatedUser();
  if ("response" in auth) return auth.response;
  const membership = await getMembershipForUserId(auth.user.id);
  const context = membership?.is_active
    ? await getCommunityContextForUserId(auth.user.id)
    : null;
  const canUpload = context
    ? context.membership.role === "admin"
    : !membership && auth.user.app_metadata.can_create_community === true;

  if (!canUpload) {
    return NextResponse.json(
      { error: "Solo un admin puede subir el logo." },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecciona una imagen valida." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "El archivo debe ser JPG, PNG, WEBP, GIF o SVG." },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "La imagen supera el limite de 5 MB." },
      { status: 400 },
    );
  }

  const supabase = auth.supabase;
  const arrayBuffer = await file.arrayBuffer();
  const pathPrefix = context
    ? `communities/${context.community.id}`
    : `onboarding/${auth.user.id}`;
  const path = `${pathPrefix}/${Date.now()}-${sanitizeFilename(file.name)}`;

  const { error } = await supabase.storage
    .from("community-assets")
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return NextResponse.json(
      { error: "No fue posible subir la imagen a Supabase Storage." },
      { status: 500 },
    );
  }

  const { data } = supabase.storage.from("community-assets").getPublicUrl(path);

  return NextResponse.json({
    ok: true,
    publicUrl: data.publicUrl,
    path,
  });
}
