export default function AppLoading() {
  return <div aria-busy="true" aria-label="Cargando contenido" className="animate-pulse space-y-4"><div className="h-32 rounded-2xl bg-muted" /><div className="h-24 rounded-2xl bg-muted" /><div className="grid grid-cols-2 gap-4"><div className="h-40 rounded-2xl bg-muted" /><div className="h-40 rounded-2xl bg-muted" /></div><span className="sr-only">Cargando…</span></div>;
}
