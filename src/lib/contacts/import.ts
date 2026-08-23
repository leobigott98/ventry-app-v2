import { normalizePhoneNumber } from "@/lib/contacts/phone";
import type { ResidentContactSource } from "@/lib/domain/types";

export type ImportedContact = {
  name: string;
  phone: string;
  source: Exclude<ResidentContactSource, "manual">;
};

type DeviceContact = { name?: string[]; tel?: string[] };
export type ContactsManager = {
  getProperties?(): Promise<string[]>;
  select(properties: Array<"name" | "tel">, options: { multiple: boolean }): Promise<DeviceContact[]>;
};

export type ContactPickResult =
  | { status: "selected"; contacts: ImportedContact[] }
  | { status: "cancelled"; contacts: [] }
  | { status: "unsupported"; contacts: [] };

export async function contactPickerIsSupported(manager: ContactsManager | undefined) {
  if (!manager?.select) return false;
  if (!manager.getProperties) return true;
  try {
    const properties = await manager.getProperties();
    return properties.includes("name") && properties.includes("tel");
  } catch {
    return false;
  }
}

export async function pickDeviceContacts(manager: ContactsManager): Promise<ContactPickResult> {
  try {
    if (!await contactPickerIsSupported(manager)) return { status: "unsupported", contacts: [] };
    const selected = await manager.select(["name", "tel"], { multiple: true });
    return {
      status: "selected",
      contacts: selected.flatMap((contact) => {
        const name = contact.name?.find((value) => value.trim())?.trim();
        const phone = contact.tel?.find((value) => normalizePhoneNumber(value));
        return name && phone ? [{ name, phone, source: "contact_picker" as const }] : [];
      }),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { status: "cancelled", contacts: [] };
    }
    throw error;
  }
}

export type ImportReviewItem = ImportedContact & {
  key: string;
  normalizedPhone: string;
  duplicate: boolean;
};

export function prepareImportReview(contacts: ImportedContact[], existingPhones: Iterable<string>) {
  const seen = new Set(existingPhones);
  return contacts.flatMap<ImportReviewItem>((contact, index) => {
    const normalizedPhone = normalizePhoneNumber(contact.phone);
    if (!normalizedPhone) return [];
    const duplicate = seen.has(normalizedPhone);
    seen.add(normalizedPhone);
    return [{ ...contact, key: `${normalizedPhone}-${index}`, normalizedPhone, duplicate }];
  });
}
