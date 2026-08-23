"use client";

import Link from "next/link";
import { Check, ContactRound, Download, Pencil, Plus, Search, Star, Trash2, UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { ResidentPageHeader } from "@/components/resident/resident-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { contactPickerIsSupported, pickDeviceContacts, prepareImportReview, type ContactsManager, type ImportReviewItem, type ImportedContact } from "@/lib/contacts/import";
import { formatPhoneForDisplay, normalizePhoneNumber } from "@/lib/contacts/phone";
import type { ResidentContactViewModel } from "@/lib/domain/types";
import { APP_TIME_ZONE } from "@/lib/formatting";
import { cn } from "@/lib/utils";

type ContactDraft = { name: string; phone: string; relationshipLabel: string; isFavorite: boolean };
type EditorState = { mode: "create" | "edit"; savedContactId?: string; initial: ContactDraft };
const emptyDraft: ContactDraft = { name: "", phone: "", relationshipLabel: "", isFavorite: false };
const avatarColors = ["bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-violet-100 text-violet-700", "bg-orange-100 text-orange-700"];

function invitationHref(contact: ResidentContactViewModel) {
  if (contact.savedContactId) return `/app/invitations/new?contactId=${encodeURIComponent(contact.savedContactId)}`;
  const params = new URLSearchParams({ visitorName: contact.name });
  if (contact.phone) params.set("visitorPhone", contact.phone);
  return `/app/invitations/new?${params.toString()}`;
}

async function responsePayload<T>(response: Response) { return response.json() as Promise<T & { error?: string }>; }

function ContactEditor({ initial, isSaving, mode, onCancel, onSave }: { initial: ContactDraft; isSaving: boolean; mode: EditorState["mode"]; onCancel: () => void; onSave: (draft: ContactDraft) => void }) {
  const [draft, setDraft] = useState(initial);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const close = useCallback(() => { if (!dirty || window.confirm("¿Cerrar sin guardar los cambios?")) onCancel(); }, [dirty, onCancel]);
  function submit(event: FormEvent) { event.preventDefault(); onSave(draft); }
  return <ResponsiveDialog description="Nombre obligatorio; teléfono, relación y favorito son opcionales." onClose={close} title={mode === "edit" ? "Editar contacto" : "Agregar contacto"}>
    <form className="flex min-h-0 flex-col" onSubmit={submit}>
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <div className="space-y-2"><Label htmlFor="contact-name">Nombre</Label><Input data-autofocus id="contact-name" maxLength={120} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Nombre completo" required value={draft.name} /></div>
        <div className="space-y-2"><Label htmlFor="contact-phone">Teléfono o WhatsApp <span className="font-normal text-muted-foreground">(opcional)</span></Label><Input id="contact-phone" inputMode="tel" maxLength={32} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} placeholder="0412 555 1234" value={draft.phone} /></div>
        <div className="space-y-2"><Label htmlFor="contact-relationship">Relación o etiqueta <span className="font-normal text-muted-foreground">(opcional)</span></Label><Input id="contact-relationship" maxLength={80} onChange={(event) => setDraft({ ...draft, relationshipLabel: event.target.value })} placeholder="Ej. Hija, médico, plomería" value={draft.relationshipLabel} /></div>
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-muted px-4"><input checked={draft.isFavorite} className="h-5 w-5 accent-[#1446cc]" onChange={(event) => setDraft({ ...draft, isFavorite: event.target.checked })} type="checkbox" /><Star className="h-4 w-4 text-amber-500" /><span className="font-semibold">Marcar como favorito</span></label>
      </div>
      <div className="sticky bottom-0 border-t border-border bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-6"><Button className="h-14 w-full rounded-xl" disabled={isSaving || draft.name.trim().length < 2} type="submit">{isSaving ? "Guardando…" : "Guardar contacto"}</Button></div>
    </form>
  </ResponsiveDialog>;
}

function ImportReview({ existingPhones, imported, isSaving, onCancel, onSave }: { existingPhones: string[]; imported: ImportedContact[]; isSaving: boolean; onCancel: () => void; onSave: (selected: ImportReviewItem[]) => void }) {
  const items = useMemo(() => prepareImportReview(imported, existingPhones), [existingPhones, imported]);
  const [selectedKeys, setSelectedKeys] = useState(() => new Set(items.filter((item) => !item.duplicate).map((item) => item.key)));
  const selected = items.filter((item) => selectedKeys.has(item.key) && !item.duplicate);
  return <ResponsiveDialog description="Elige qué personas guardar. Solo usamos nombre y teléfono; no obtenemos acceso permanente a tu agenda." onClose={onCancel} title="Revisar contactos" wide>
    <div className="space-y-2 px-5 py-4 sm:px-6">{items.map((item) => <label className={cn("flex min-h-16 items-center gap-3 rounded-xl border p-3", item.duplicate ? "cursor-not-allowed bg-muted/60 opacity-70" : "cursor-pointer")} key={item.key}><input aria-label={`Importar ${item.name}`} checked={selectedKeys.has(item.key) && !item.duplicate} className="h-5 w-5 accent-[#1446cc]" disabled={item.duplicate} onChange={(event) => setSelectedKeys((current) => { const next = new Set(current); if (event.target.checked) next.add(item.key); else next.delete(item.key); return next; })} type="checkbox" /><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{item.name}</span><span className="text-sm text-muted-foreground">{formatPhoneForDisplay(item.phone)}</span></span>{item.duplicate ? <span className="rounded-full bg-secondary px-2 py-1 text-xs font-bold text-primary">Ya existe</span> : <Check className="h-4 w-4 text-accent" />}</label>)}{items.length === 0 ? <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">No seleccionaste contactos con nombre y teléfono válidos.</p> : null}</div>
    <div className="sticky bottom-0 border-t border-border bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-6"><Button className="h-14 w-full rounded-xl" disabled={isSaving || selected.length === 0} onClick={() => onSave(selected)}>{isSaving ? "Importando…" : `Guardar ${selected.length} ${selected.length === 1 ? "contacto" : "contactos"}`}</Button></div>
  </ResponsiveDialog>;
}

function ContactDetails({ contact, isSaving, onClose, onDelete, onEdit, onSaveHistory, onToggleFavorite, timeZone }: { contact: ResidentContactViewModel; isSaving: boolean; onClose: () => void; onDelete: () => void; onEdit: () => void; onSaveHistory: () => void; onToggleFavorite: () => void; timeZone: string }) {
  const lastVisit = contact.lastInvitedAt ? new Intl.DateTimeFormat("es-VE", { dateStyle: "medium", timeZone }).format(new Date(contact.lastInvitedAt)) : "Sin invitaciones todavía";
  return <ResponsiveDialog onClose={onClose} title="Detalle del contacto">
    <div className="px-5 py-5 sm:px-6"><div className="flex items-center gap-4"><span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-700">{contact.name.charAt(0).toUpperCase()}</span><div className="min-w-0"><h3 className="truncate text-xl font-extrabold">{contact.name}</h3><p className="mt-1 text-sm text-muted-foreground">{contact.relationshipLabel || (contact.origin === "history" ? "Sugerido por tu historial" : "Contacto guardado")}</p></div></div>
      <dl className="mt-5 divide-y divide-border rounded-2xl bg-muted/60 px-4 text-sm"><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Teléfono</dt><dd className="text-right font-semibold">{contact.phone ? formatPhoneForDisplay(contact.phone) : "No registrado"}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Invitaciones</dt><dd className="font-semibold">{contact.invitationCount}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Última invitación</dt><dd className="text-right font-semibold">{lastVisit}</dd></div>{contact.savedContactId ? <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Favorito</dt><dd className="font-semibold">{contact.isFavorite ? "Sí" : "No"}</dd></div> : null}</dl>
      <Button asChild className="mt-5 h-14 w-full rounded-xl"><Link href={invitationHref(contact)}><UserPlus className="h-5 w-5" /> Invitar</Link></Button>
      {contact.savedContactId ? <div className="mt-3 grid gap-2"><Button disabled={isSaving} onClick={onEdit} variant="outline"><Pencil className="h-4 w-4" /> Editar</Button><Button disabled={isSaving} onClick={onToggleFavorite} variant="outline"><Star className={cn("h-4 w-4", contact.isFavorite && "fill-amber-400 text-amber-400")} /> {contact.isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}</Button><Button className="text-danger" disabled={isSaving} onClick={onDelete} variant="ghost"><Trash2 className="h-4 w-4" /> Eliminar de mis contactos</Button></div> : <Button className="mt-3 w-full" disabled={isSaving} onClick={onSaveHistory} variant="outline"><Plus className="h-4 w-4" /> Guardar contacto</Button>}
    </div>
  </ResponsiveDialog>;
}

export function ResidentContactsManager({ initialContacts, initialTotal, timeZone = APP_TIME_ZONE }: { initialContacts: ResidentContactViewModel[]; initialTotal: number; timeZone?: string }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selected, setSelected] = useState<ResidentContactViewModel | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [imported, setImported] = useState<ImportedContact[] | null>(null);
  const [importExistingPhones, setImportExistingPhones] = useState<string[]>([]);
  const [picker, setPicker] = useState<ContactsManager | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const reload = useCallback(async () => {
    const response = await fetch("/api/contacts?page=1&pageSize=50");
    const payload = await responsePayload<{ items?: ResidentContactViewModel[]; total?: number }>(response);
    if (!response.ok || !payload.items) throw new Error(payload.error || "No fue posible actualizar la lista.");
    setContacts(payload.items); setTotal(payload.total ?? payload.items.length); setPage(1);
    setSelected((current) => current ? payload.items!.find((item) => item.stableId === current.stableId || (current.savedContactId && item.savedContactId === current.savedContactId)) ?? null : null);
  }, []);

  async function loadMore() {
    const nextPage = page + 1;
    const response = await fetch(`/api/contacts?page=${nextPage}&pageSize=50`);
    const payload = await responsePayload<{ items?: ResidentContactViewModel[]; total?: number }>(response);
    if (!response.ok || !payload.items) { setMessage({ text: payload.error || "No fue posible cargar más contactos.", error: true }); return; }
    setContacts((current) => [...current, ...payload.items!]); setTotal(payload.total ?? total); setPage(nextPage);
  }

  useEffect(() => {
    const manager = (navigator as Navigator & { contacts?: ContactsManager }).contacts;
    if (window.isSecureContext === false) { setPicker(null); return; }
    void contactPickerIsSupported(manager).then((supported) => setPicker(supported && manager ? manager : null));
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es-VE");
    return contacts.filter((contact) => (!favoritesOnly || contact.isFavorite) && (!needle || `${contact.name} ${contact.relationshipLabel ?? ""} ${contact.phone ?? ""}`.toLocaleLowerCase("es-VE").includes(needle)));
  }, [contacts, favoritesOnly, query]);

  async function chooseFromPhone() {
    if (!picker) return;
    setMessage(null);
    try {
      const result = await pickDeviceContacts(picker);
      if (result.status === "selected") {
        const response = await fetch("/api/contacts/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phones: result.contacts.map((contact) => contact.phone) }) });
        const payload = await responsePayload<{ normalizedPhones?: string[] }>(response);
        if (!response.ok || !payload.normalizedPhones) throw new Error(payload.error || "No fue posible revisar los contactos.");
        setImportExistingPhones(payload.normalizedPhones);
        setImported(result.contacts);
      }
      else if (result.status === "cancelled") setMessage({ text: "Selección cancelada. No se guardó nada." });
    } catch { setMessage({ text: "No pudimos abrir tus contactos. Puedes agregar uno manualmente.", error: true }); }
  }

  async function saveDraft(draft: ContactDraft) {
    if (!editor) return;
    setIsSaving(true); setMessage(null);
    try {
      const response = await fetch(editor.mode === "edit" ? `/api/contacts/${editor.savedContactId}` : "/api/contacts", { method: editor.mode === "edit" ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editor.mode === "edit" ? draft : { contacts: [{ ...draft, source: "manual" }] }) });
      const payload = await responsePayload<Record<string, never>>(response);
      if (!response.ok) throw new Error(payload.error || "No fue posible guardar el contacto.");
      const wasEdit = editor.mode === "edit"; setEditor(null); await reload(); setMessage({ text: wasEdit ? "Contacto actualizado." : "Contacto guardado." });
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : "No fue posible guardar el contacto.", error: true }); }
    finally { setIsSaving(false); }
  }

  async function importSelected(items: ImportReviewItem[]) {
    setIsSaving(true); setMessage(null);
    try {
      const response = await fetch("/api/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contacts: items.map((item) => ({ name: item.name, phone: item.phone, source: "contact_picker" })) }) });
      const payload = await responsePayload<Record<string, never>>(response);
      if (!response.ok) throw new Error(payload.error || "No fue posible guardar los contactos.");
      setImported(null); setImportExistingPhones([]); await reload(); setMessage({ text: `${items.length} ${items.length === 1 ? "contacto guardado" : "contactos guardados"}.` });
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : "No fue posible guardar los contactos.", error: true }); }
    finally { setIsSaving(false); }
  }

  function editContact(contact: ResidentContactViewModel) {
    if (!contact.savedContactId) return;
    setSelected(null); setEditor({ mode: "edit", savedContactId: contact.savedContactId, initial: { name: contact.name, phone: contact.phone ?? "", relationshipLabel: contact.relationshipLabel ?? "", isFavorite: contact.isFavorite } });
  }

  async function patchSelected(body: object) {
    if (!selected?.savedContactId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/contacts/${selected.savedContactId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error((await responsePayload<Record<string, never>>(response)).error || "No fue posible actualizar el contacto.");
      await reload();
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : "No fue posible actualizar el contacto.", error: true }); }
    finally { setIsSaving(false); }
  }

  async function deleteSelected() {
    if (!selected?.savedContactId || !window.confirm(`¿Eliminar a ${selected.name} de tus contactos? El historial de invitaciones se conservará.`)) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/contacts/${selected.savedContactId}`, { method: "DELETE" });
      if (!response.ok) throw new Error((await responsePayload<Record<string, never>>(response)).error || "No fue posible eliminar el contacto.");
      setSelected(null); await reload(); setMessage({ text: "Contacto eliminado. Su historial se conserva." });
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : "No fue posible eliminar el contacto.", error: true }); }
    finally { setIsSaving(false); }
  }

  return <section className="min-h-[100dvh] bg-background">
    <ResidentPageHeader title="Contactos frecuentes" />
    <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 md:py-6">
      <div className="flex items-center gap-2"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><input aria-label="Buscar contactos" className="h-14 w-full rounded-2xl border-0 bg-muted pl-12 pr-4 text-base outline-none ring-primary/25 focus:ring-2" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre" type="search" value={query} /></div><button aria-label="Mostrar solo favoritos" aria-pressed={favoritesOnly} className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full", favoritesOnly ? "bg-amber-50 text-amber-600" : "text-muted-foreground hover:bg-muted")} onClick={() => setFavoritesOnly((value) => !value)}><Star className={cn("h-5 w-5", favoritesOnly && "fill-current")} /></button></div>
      <div className="mt-3 flex flex-wrap gap-2"><Button className="h-11 rounded-xl px-3" onClick={() => setEditor({ mode: "create", initial: emptyDraft })} variant="outline"><Plus className="h-4 w-4" /> Agregar contacto</Button>{picker ? <Button className="h-11 rounded-xl px-3" onClick={() => void chooseFromPhone()} variant="secondary"><Download className="h-4 w-4" /> Elegir del teléfono</Button> : null}</div>
      {message ? <p className={cn("mt-3 rounded-xl px-4 py-3 text-sm font-medium", message.error ? "bg-danger/10 text-danger" : "bg-emerald-50 text-emerald-800")} role={message.error ? "alert" : "status"}>{message.text}</p> : null}

      <div className="mt-4 overflow-hidden rounded-2xl bg-surface px-4 shadow-[0_6px_18px_rgba(12,18,33,0.05)]">
        {filtered.map((contact, index) => <article className="flex min-h-[5.9rem] items-center gap-2 border-b border-border py-3 last:border-0" data-testid="contact-row" key={contact.stableId}><button aria-label={`Abrir opciones de ${contact.name}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => setSelected(contact)} type="button"><span aria-hidden="true" className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold", avatarColors[index % avatarColors.length])}>{contact.name.charAt(0).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-1.5"><span className="block truncate font-bold sm:text-[17px]">{contact.name}</span>{contact.isFavorite ? <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" /> : null}</span><span className="mt-1 block truncate text-sm text-muted-foreground">{contact.relationshipLabel || (contact.invitationCount === 1 ? "1 invitación anterior" : `${contact.invitationCount} invitaciones anteriores`)}</span></span></button><Link aria-label={`Invitar a ${contact.name}`} className="inline-flex min-h-12 w-[6.25rem] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-2 text-sm font-bold text-white sm:w-[6.75rem]" href={invitationHref(contact)}><UserPlus className="h-4 w-4" /> Invitar</Link></article>)}
        {filtered.length === 0 ? <div className="px-3 py-14 text-center"><ContactRound className="mx-auto h-9 w-9 text-muted-foreground" /><h2 className="mt-4 font-bold">{contacts.length === 0 ? "Aún no hay contactos frecuentes" : "Sin coincidencias"}</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-5 text-muted-foreground">{contacts.length === 0 ? "Cuando crees invitaciones, las personas aparecerán aquí automáticamente. También puedes agregar un contacto." : "Prueba con otro nombre o desactiva el filtro de favoritos."}</p></div> : null}
      </div>
      {total > contacts.length ? <Button className="mt-4 w-full" onClick={() => void loadMore()} variant="ghost">Ver más contactos · {contacts.length} de {total}</Button> : null}
    </div>

    {selected ? <ContactDetails contact={selected} isSaving={isSaving} onClose={() => setSelected(null)} onDelete={() => void deleteSelected()} onEdit={() => editContact(selected)} onSaveHistory={() => { const current = selected; setSelected(null); setEditor({ mode: "create", initial: { name: current.name, phone: current.phone ?? "", relationshipLabel: "", isFavorite: false } }); }} onToggleFavorite={() => void patchSelected({ isFavorite: !selected.isFavorite })} timeZone={timeZone} /> : null}
    {editor ? <ContactEditor initial={editor.initial} isSaving={isSaving} mode={editor.mode} onCancel={() => setEditor(null)} onSave={(draft) => void saveDraft(draft)} /> : null}
    {imported ? <ImportReview existingPhones={[...importExistingPhones, ...contacts.flatMap((contact) => { const phone = contact.phone ? normalizePhoneNumber(contact.phone) : null; return phone ? [phone] : []; })]} imported={imported} isSaving={isSaving} onCancel={() => { setImported(null); setImportExistingPhones([]); }} onSave={(items) => void importSelected(items)} /> : null}
  </section>;
}
