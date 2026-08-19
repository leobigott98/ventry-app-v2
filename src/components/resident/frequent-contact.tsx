import Link from "next/link";
import { UserPlus } from "lucide-react";

import type { FrequentVisitorContact } from "@/lib/domain/invitations";

const contactColors = ["bg-[#d9e9ff] text-[#1550df]", "bg-[#c8f8df] text-[#00845f]", "bg-[#ece5ff] text-[#6d16e8]"];

export function ContactAvatar({ contact, index = 0 }: { contact: FrequentVisitorContact; index?: number }) {
  const initial = contact.name.trim().charAt(0).toLocaleUpperCase("es-VE") || "?";
  return <span aria-hidden="true" className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold ${contactColors[index % contactColors.length]}`}>{initial}</span>;
}

export function FrequentContactRow({ contact, index }: { contact: FrequentVisitorContact; index: number }) {
  return <div className="flex items-center gap-3 border-b border-border py-4 last:border-0"><ContactAvatar contact={contact} index={index} /><div className="min-w-0 flex-1"><p className="truncate font-bold">{contact.name}</p><p className="mt-0.5 text-sm text-muted-foreground">{contact.invitationCount === 1 ? "1 invitación anterior" : `${contact.invitationCount} invitaciones anteriores`}</p></div><Link className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-white" href={`/app/invitations/new?visitorName=${encodeURIComponent(contact.name)}`}><UserPlus className="h-4 w-4" /> Invitar</Link></div>;
}
