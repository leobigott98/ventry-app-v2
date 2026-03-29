import { z } from "zod";

import { nullableOptionalText } from "@/lib/schemas/community";

export const teamMemberAccessSchema = z.object({
  fullName: z.string().trim().min(2, "Ingresa nombre y apellido."),
  email: z.string().trim().email("Ingresa un correo valido."),
  phone: nullableOptionalText,
  role: z.enum(["admin", "guard"]),
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres."),
  notes: nullableOptionalText,
});

export const residentAccessSchema = z.object({
  email: z.string().trim().email("Ingresa un correo valido."),
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres."),
});

export type TeamMemberAccessInput = z.infer<typeof teamMemberAccessSchema>;
export type ResidentAccessInput = z.infer<typeof residentAccessSchema>;
