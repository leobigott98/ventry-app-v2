import { z } from "zod";

import { arrivalWindowFieldsSchema, validateArrivalWindow } from "@/lib/schemas/arrival-window";
import { eventGuestSchema } from "@/lib/schemas/events";
import { invitationVisitorSchema } from "@/lib/schemas/invitations";
import { nullableOptionalText } from "@/lib/schemas/community";
import { invitationAccessTypeOptions } from "@/lib/domain/types";

const idempotentMutation = {
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.string().uuid(),
};

const accessType = z.enum(
  invitationAccessTypeOptions.map((option) => option.value) as [string, ...string[]],
);

export const updateManagedInvitationSchema = z.object({
  ...idempotentMutation,
  visitorName: nullableOptionalText,
  visitorPhone: nullableOptionalText,
  residentContactId: z.string().uuid().nullable().optional(),
  accessType,
  notes: nullableOptionalText,
}).merge(arrivalWindowFieldsSchema).superRefine((input,ctx)=>{
  validateArrivalWindow(input,ctx);
  if(input.accessType!=="delivery"&&!input.visitorName)ctx.addIssue({code:z.ZodIssueCode.custom,path:["visitorName"],message:"Ingresa el nombre del visitante."});
});

export const updateManagedGroupSchema = z.object({
  ...idempotentMutation,
  accessType,
  notes: nullableOptionalText,
}).merge(arrivalWindowFieldsSchema).superRefine(validateArrivalWindow);

export const updateManagedEventSchema = z.object({
  ...idempotentMutation,
  name: z.string().trim().min(2).max(120),
  notes: nullableOptionalText,
  defaultAllowsCompanions: z.boolean(),
  defaultMaxCompanions: z.number().int().min(0).max(5),
}).merge(arrivalWindowFieldsSchema.omit({ visitDate: true }).extend({
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})).superRefine((input, ctx) => {
  validateArrivalWindow({ ...input, visitDate: input.eventDate }, ctx);
  if ((!input.defaultAllowsCompanions && input.defaultMaxCompanions !== 0)
    || (input.defaultAllowsCompanions && input.defaultMaxCompanions < 1)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["defaultMaxCompanions"], message: "Configura entre 1 y 5 acompañantes, o desactívalos." });
  }
});

export const cancelManagedAccessSchema = z.object({
  ...idempotentMutation,
  reason: z.string().trim().max(500).nullable().optional(),
});

export const addManagedGroupMembersSchema = z.object({
  ...idempotentMutation,
  visitors: z.array(invitationVisitorSchema).min(1).max(25),
});

export const removeManagedMemberSchema = cancelManagedAccessSchema;

export const addManagedEventGuestsSchema = z.object({
  ...idempotentMutation,
  guests: z.array(eventGuestSchema).min(1).max(500),
});

export const updateManagedEventGuestSchema = eventGuestSchema.extend({
  ...idempotentMutation,
  expectedGuestVersion: z.number().int().positive(),
  allowsCompanions: z.boolean(),
  maxCompanions: z.number().int().min(0).max(5),
}).superRefine((input, ctx) => {
  if ((!input.allowsCompanions && input.maxCompanions !== 0)
    || (input.allowsCompanions && input.maxCompanions < 1)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["maxCompanions"], message: "Configura entre 1 y 5 acompañantes, o desactívalos." });
  }
});

export const duplicateInvitationSchema = z.object(idempotentMutation).merge(arrivalWindowFieldsSchema).superRefine(validateArrivalWindow);
export const duplicateEventSchema = z.object(idempotentMutation).merge(arrivalWindowFieldsSchema.omit({ visitDate: true }).extend({ eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).superRefine((input, ctx) => validateArrivalWindow({ ...input, visitDate: input.eventDate }, ctx));

export type UpdateManagedInvitationInput = z.infer<typeof updateManagedInvitationSchema>;
export type UpdateManagedGroupInput = z.infer<typeof updateManagedGroupSchema>;
export type UpdateManagedEventInput = z.infer<typeof updateManagedEventSchema>;
export type UpdateManagedEventGuestInput = z.infer<typeof updateManagedEventGuestSchema>;
