import Link from "next/link";
import { ChevronRight, Clock3, Mic, PhoneCall, UserPlus } from "lucide-react";

import { ContactAvatar } from "@/components/resident/frequent-contact";
import { ResidentHomeHeader } from "@/components/resident/resident-header";
import type { FrequentVisitorContact } from "@/lib/domain/invitations";

type ResidentNotification = {
  id: string;
  title: string;
  detail: string;
  href: string;
};

export function ResidentDashboard({
  activeCount,
  communityName,
  contacts,
  firstName,
  greeting,
  notifications,
  unitLabel,
}: {
  activeCount: number;
  communityName: string;
  contacts: FrequentVisitorContact[];
  firstName: string;
  greeting: string;
  notifications: ResidentNotification[];
  unitLabel: string;
}) {
  return (
    <section>
      <ResidentHomeHeader
        communityName={communityName}
        firstName={firstName}
        greeting={greeting}
        notifications={notifications}
        unitLabel={unitLabel}
      />
      <div className="relative -mt-8 space-y-4 px-4 pb-7 sm:px-6 md:-mt-5 md:px-8 md:pb-10 xl:px-10">
        <Link
          className="flex min-h-[5.4rem] items-center justify-between gap-3 rounded-[1.15rem] border border-border bg-surface px-4 py-3 shadow-[0_10px_24px_rgba(12,18,33,0.10)]"
          href="/app/invitations?status=current"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f7f2] text-accent">
              <Clock3 aria-hidden="true" className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-[15px] font-bold">
                {activeCount === 1 ? "1 invitación activa" : `${activeCount} invitaciones activas`}
              </span>
              <span className="mt-0.5 block text-sm font-medium text-muted-foreground">Toca para ver los detalles</span>
            </span>
          </span>
          <ChevronRight aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
        </Link>

        <div className="grid gap-4 xl:grid-cols-[minmax(22rem,1.2fr)_minmax(20rem,0.8fr)]">
          <Link
            className="flex min-h-[6.7rem] items-center gap-4 rounded-[1.15rem] bg-primary p-5 text-white shadow-[0_12px_26px_rgba(20,70,204,0.18)] transition hover:bg-primary/90"
            href="/app/invitations/new"
          >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1rem] bg-white/15">
            <UserPlus aria-hidden="true" className="h-7 w-7" />
          </span>
          <span>
            <span className="block text-[1.15rem] font-bold">Invitar una visita</span>
            <span className="mt-1 block text-[15px] text-white/75">Crear invitación con QR o PIN</span>
          </span>
          </Link>

          <div className="grid grid-cols-2 gap-3">
          {[
            { href: "/app/invitations/voice", label: <>Invitar<br />hablando</>, icon: Mic },
            { href: "/app/intercom", label: <>Llamar<br />a la garita</>, icon: PhoneCall },
          ].map((item) => (
            <Link
              className="flex min-h-[7.5rem] flex-col items-center justify-center gap-3 rounded-[1.15rem] border border-border bg-surface p-3 text-center text-[15px] font-semibold leading-5 transition hover:border-primary/30"
              href={item.href}
              key={item.href}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
                <item.icon aria-hidden="true" className="h-6 w-6" />
              </span>
              {item.label}
            </Link>
          ))}
          </div>
        </div>

        <div className="pt-1 xl:max-w-4xl">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Contactos frecuentes</h2>
            <Link className="text-sm font-bold text-primary" href="/app/contacts">Ver todos</Link>
          </div>
          {contacts.length > 0 ? (
            <div className="mt-2 flex gap-5 overflow-x-auto pb-2">
              {contacts.map((contact, index) => (
                <Link
                  className="flex w-16 shrink-0 flex-col items-center text-center"
                  href={`/app/invitations/new?visitorName=${encodeURIComponent(contact.name)}`}
                  key={contact.name}
                >
                  <ContactAvatar contact={contact} index={index} />
                  <span className="mt-2 w-full truncate text-xs font-semibold">{contact.name}</span>
                  <span className="mt-1 text-[10px] text-muted-foreground">
                    {contact.invitationCount} {contact.invitationCount === 1 ? "visita" : "visitas"}
                  </span>
                </Link>
              ))}
              <AddContact />
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-4 py-2">
              <AddContact compact />
              <p className="max-w-xs text-sm leading-5 text-muted-foreground">
                Tus visitantes habituales aparecerán aquí según tu historial.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AddContact({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="flex w-16 shrink-0 flex-col items-center text-center" href="/app/contacts">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-2xl font-semibold text-muted-foreground">+</span>
      <span className="mt-2 text-xs font-semibold">Agregar</span>
      {!compact ? <span className="mt-1 text-[10px] text-muted-foreground">Próximamente</span> : null}
    </Link>
  );
}
