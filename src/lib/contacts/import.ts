import { normalizePhoneNumber } from "@/lib/contacts/phone";
import type { ResidentContactSource } from "@/lib/domain/types";

export type ImportedContact = {
  name: string;
  phone: string;
  source: Exclude<ResidentContactSource, "manual">;
};

type DeviceContact = { name?: string[]; tel?: string[] };
type ContactsManager = {
  select(properties: Array<"name" | "tel">, options: { multiple: boolean }): Promise<DeviceContact[]>;
};

export type ContactPickResult =
  | { status: "selected"; contacts: ImportedContact[] }
  | { status: "cancelled"; contacts: [] };

export async function pickDeviceContacts(manager: ContactsManager): Promise<ContactPickResult> {
  try {
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

function unfoldVCard(value: string) {
  return value.replace(/\r?\n[ \t]/g, "");
}

function unescapeVCard(value: string) {
  return value.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}

export function parseVCard(value: string): ImportedContact[] {
  const cards = unfoldVCard(value).split(/BEGIN:VCARD/i).slice(1, 201);
  return cards.flatMap((card) => {
    const lines = card.split(/\r?\n/);
    const fn = lines.find((line) => /^FN(?:;[^:]*)?:/i.test(line));
    const structuredName = lines.find((line) => /^N(?:;[^:]*)?:/i.test(line));
    const tel = lines.find((line) => /^TEL(?:;[^:]*)?:/i.test(line));
    const fnValue = fn?.slice(fn.indexOf(":") + 1);
    const nValue = structuredName?.slice(structuredName.indexOf(":") + 1)
      .split(";").filter(Boolean).reverse().join(" ");
    const name = unescapeVCard(fnValue || nValue || "");
    const phone = unescapeVCard(tel?.slice(tel.indexOf(":") + 1) || "");
    return name && normalizePhoneNumber(phone) ? [{ name, phone, source: "vcard" as const }] : [];
  });
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
