import Link from "next/link";
import { ArrowLeft, Mic, PhoneOff, Shield, ShieldCheck } from "lucide-react";

import { ResidentPageHeader } from "@/components/resident/resident-header";

export function VoiceUnavailable() {
  return (
    <section className="min-h-[100dvh] bg-background">
      <ResidentPageHeader title="Invitar hablando" subtitle="La integración de voz aún no está disponible" />
      <div className="flex min-h-[calc(100dvh-13rem)] flex-col items-center justify-center px-6 pb-10 text-center">
        <button
          aria-describedby="voice-unavailable"
          aria-label="Grabación de voz no disponible"
          className="flex h-36 w-36 cursor-not-allowed items-center justify-center rounded-full bg-primary text-white opacity-55 shadow-[0_18px_46px_rgba(20,70,204,0.22)]"
          disabled
          type="button"
        >
          <Mic aria-hidden="true" className="h-16 w-16" />
        </button>
        <h2 className="mt-8 text-xl font-bold">Próximamente</h2>
        <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground" id="voice-unavailable">
          No grabamos ni transcribimos audio hasta contar con permisos, privacidad y procesamiento reales.
        </p>
        <div className="mt-6 flex max-w-sm gap-3 rounded-2xl bg-secondary p-4 text-left text-sm leading-5 text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
          Toda invitación futura requerirá revisión antes de usar la misma API segura del formulario.
        </div>
        <Link className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-primary px-6 font-bold text-white" href="/app/invitations/new">
          Crear invitación manual
        </Link>
      </div>
    </section>
  );
}

export function IntercomUnavailable({ communityName }: { communityName: string }) {
  return (
    <section className="min-h-[100dvh] bg-[#070d1a] px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+1rem)] text-white sm:px-7">
      <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white/65" href="/app/dashboard">
        <ArrowLeft aria-hidden="true" className="h-5 w-5" /> Volver
      </Link>
      <div className="flex min-h-[calc(100dvh-7rem)] flex-col items-center justify-center text-center">
        <span className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-[#00e990] bg-[#071721] text-[#00e990] shadow-[0_0_0_44px_rgba(0,233,144,0.025)]">
          <Shield aria-hidden="true" className="h-14 w-14" />
        </span>
        <p className="mt-12 text-xs font-bold uppercase tracking-[0.18em] text-white/45">Intercomunicador no disponible</p>
        <h1 className="mt-3 text-3xl font-extrabold">Garita</h1>
        <p className="mt-2 text-sm text-white/45">{communityName}</p>
        <div className="mt-10 w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.07] p-5">
          <PhoneOff aria-hidden="true" className="mx-auto h-7 w-7 text-white/55" />
          <p className="mt-3 font-bold">No hay telefonía integrada</p>
          <p className="mt-2 text-sm leading-6 text-white/50">No podemos iniciar, recibir ni simular llamadas desde esta comunidad.</p>
        </div>
        <Link className="mt-8 inline-flex min-h-12 items-center justify-center rounded-2xl bg-primary px-6 font-bold" href="/app/invitations/new">
          Crear invitación
        </Link>
      </div>
    </section>
  );
}
