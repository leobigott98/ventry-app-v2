import { formatAppDateTime } from "@/lib/formatting";

export function AccessChangeHistory({ items }: { items: Array<Record<string, unknown>> }) {
  return <details className="rounded-2xl border border-border bg-surface px-4">
    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 font-bold"><span>Historial de cambios</span><span className="text-xs font-medium text-muted-foreground">{items.length}</span></summary>
    <div className="space-y-3 border-t border-border py-4">{items.length ? items.map((item) => <article className="min-w-0 rounded-xl border border-border p-3" key={String(item.id)}><p className="font-semibold">{changeLabel(String(item.changeType ?? "updated"))}</p><p className="mt-1 break-words text-xs text-muted-foreground">{String(item.actorEmail ?? "Usuario")} · {formatAppDateTime(String(item.createdAt),{dateStyle:"medium",timeStyle:"short"})}</p>{item.reason?<p className="mt-2 break-words text-sm">Motivo: {String(item.reason)}</p>:null}<ChangedFields value={item.changedFields}/></article>) : <p className="py-3 text-sm text-muted-foreground">Todavía no hay cambios posteriores a la creación.</p>}</div>
  </details>;
}

function ChangedFields({value}:{value:unknown}){if(!Array.isArray(value)||!value.length)return null;return <p className="mt-2 break-words text-xs text-muted-foreground">Campos: {value.map(String).join(", ")}</p>}
function changeLabel(value:string){return ({updated:"Datos actualizados",cancelled:"Acceso cancelado",duplicated:"Acceso duplicado",members_added:"Personas agregadas",member_removed:"Persona retirada",guests_added:"Invitados agregados",removed:"Invitado retirado"} as Record<string,string>)[value]??"Cambio registrado";}
