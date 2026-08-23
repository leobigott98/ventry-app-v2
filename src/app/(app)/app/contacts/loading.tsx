export default function ContactsLoading() {
  return <div aria-busy="true" aria-label="Cargando contactos" className="min-h-[100dvh] animate-pulse bg-background">
    <div className="h-36 bg-primary" />
    <div className="space-y-4 px-4 py-5"><div className="h-14 rounded-2xl bg-muted" /><div className="h-14 rounded-2xl bg-muted" />{Array.from({ length: 4 }, (_, index) => <div className="h-24 rounded-2xl bg-muted" key={index} />)}</div>
    <span className="sr-only">Cargando…</span>
  </div>;
}
