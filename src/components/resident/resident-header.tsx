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
  return <header className="bg-primary px-5 pb-16 pt-[calc(env(safe-area-inset-top)+1.15rem)] text-white sm:px-7 md:px-8 md:pb-10 md:pt-7 xl:px-10">
    <div className="flex items-center justify-between md:max-w-[92rem]">
      <Link aria-label="Ventry, ir al inicio" className="flex min-h-11 items-center gap-2 text-lg font-bold" href="/app/dashboard"><Shield className="h-5 w-5" /> Ventry</Link>
      <NotificationSheet notifications={notifications} />
    </div>
    <div className="md:grid md:max-w-[92rem] md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-8">
      <div>
        <p className="mt-5 text-[15px] font-medium text-white/65 md:mt-4">{communityName}</p>
        <h1 className="mt-3 text-[2rem] font-extrabold leading-[1.15] tracking-[-0.035em] md:text-[2.35rem]">{greeting}, <br className="md:hidden" />{firstName}</h1>
      </div>
      <p className="mt-2 text-[15px] font-medium text-white/70 md:mb-1 md:text-right">{unitLabel}</p>
    </div>
  </header>;
}

type ResidentPageHeaderProps = {
  title: string;
  subtitle?: string;
  backHref?: string;
  progress?: { current: number; total: number };
};

export function ResidentPageHeader({ backHref = "/app/dashboard", progress, subtitle, title }: ResidentPageHeaderProps) {
  return <header className="bg-primary px-5 pb-7 pt-[calc(env(safe-area-inset-top)+1rem)] text-white sm:px-7 md:px-8 md:pb-6 md:pt-5 xl:px-10">
    <div className="md:max-w-[92rem]">
      <Link className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-white/75 hover:text-white" href={backHref}><ArrowLeft className="h-5 w-5" /> Volver</Link>
      <div className="md:flex md:items-end md:justify-between md:gap-8">
        <div>
          <h1 className="mt-5 text-[1.85rem] font-extrabold leading-tight tracking-[-0.035em] md:mt-2 md:text-[2rem]">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-[15px] text-white/65">{subtitle}</p> : null}
        </div>
        {progress ? <div className="mt-5 md:w-[22rem] md:max-w-[38%]"><div aria-label={`Paso ${progress.current} de ${progress.total}`} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${progress.total}, minmax(0, 1fr))` }}>{Array.from({ length: progress.total }, (_, index) => <span key={index} className={`h-1.5 rounded-full ${index < progress.current ? "bg-white" : "bg-white/25"}`} />)}</div><p className="mt-2 text-sm text-white/65">Paso {progress.current} de {progress.total}</p></div> : null}
      </div>
    </div>
  </header>;
}
