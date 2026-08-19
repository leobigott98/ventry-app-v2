import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

import { NotificationSheet, type ResidentNotification } from "@/components/resident/notification-sheet";

type ResidentHomeHeaderProps = {
  communityName: string;
  greeting: string;
  firstName: string;
  unitLabel: string;
  notifications: ResidentNotification[];
};

export function ResidentHomeHeader({ communityName, firstName, greeting, notifications, unitLabel }: ResidentHomeHeaderProps) {
  return <header className="bg-primary px-5 pb-16 pt-[calc(env(safe-area-inset-top)+1.15rem)] text-white sm:px-7">
    <div className="flex items-center justify-between">
      <Link aria-label="Ventry, ir al inicio" className="flex min-h-11 items-center gap-2 text-lg font-bold" href="/app/dashboard"><Shield className="h-5 w-5" /> Ventry</Link>
      <NotificationSheet notifications={notifications} />
    </div>
    <p className="mt-5 text-[15px] font-medium text-white/65">{communityName}</p>
    <h1 className="mt-3 text-[2rem] font-extrabold leading-[1.15] tracking-[-0.035em]">{greeting},<br />{firstName}</h1>
    <p className="mt-2 text-[15px] font-medium text-white/70">{unitLabel}</p>
  </header>;
}

type ResidentPageHeaderProps = {
  title: string;
  subtitle?: string;
  backHref?: string;
  progress?: { current: number; total: number };
};

export function ResidentPageHeader({ backHref = "/app/dashboard", progress, subtitle, title }: ResidentPageHeaderProps) {
  return <header className="bg-primary px-5 pb-7 pt-[calc(env(safe-area-inset-top)+1rem)] text-white sm:px-7">
    <Link className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-white/75 hover:text-white" href={backHref}><ArrowLeft className="h-5 w-5" /> Volver</Link>
    <h1 className="mt-5 text-[1.85rem] font-extrabold leading-tight tracking-[-0.035em]">{title}</h1>
    {subtitle ? <p className="mt-1.5 text-[15px] text-white/65">{subtitle}</p> : null}
    {progress ? <div className="mt-5"><div aria-label={`Paso ${progress.current} de ${progress.total}`} className="grid grid-cols-3 gap-2">{Array.from({ length: progress.total }, (_, index) => <span key={index} className={`h-1.5 rounded-full ${index < progress.current ? "bg-white" : "bg-white/25"}`} />)}</div><p className="mt-2 text-sm text-white/65">Paso {progress.current} de {progress.total}</p></div> : null}
  </header>;
}
