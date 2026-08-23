"use client";

import Link from "next/link";
import {
  Check,
  Download,
  FileUp,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";

import { ResidentPageHeader } from "@/components/resident/resident-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPhoneForDisplay } from "@/lib/contacts/phone";
import {
  parseVCard,
  pickDeviceContacts,
  prepareImportReview,
  type ImportReviewItem,
  type ImportedContact,
} from "@/lib/contacts/import";
import type { ResidentContactRecord } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

type ContactsManager = Parameters<typeof pickDeviceContacts>[0];
type ContactDraft = { name: string; phone: string; relationshipLabel: string; isFavorite: boolean };

const emptyDraft: ContactDraft = { name: "", phone: "", relationshipLabel: "", isFavorite: false };
const avatarColors = ["bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-violet-100 text-violet-700", "bg-orange-100 text-orange-700"];

function sortContacts(contacts: ResidentContactRecord[]) {
  return [...contacts].sort((left, right) => Number(right.is_favorite) - Number(left.is_favorite) || (right.last_invited_at ?? "").localeCompare(left.last_invited_at ?? "") || left.name.localeCompare(right.name, "es"));
}

async function readPayload<T>(response: Response): Promise<T & { error?: string }> {
  return response.json() as Promise<T & { error?: string }>;
}

function ContactForm({
  draft,
  isSaving,
  onCancel,
  onChange,
  onSubmit,
  title,
}: {
  draft: ContactDraft;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (draft: ContactDraft) => void;
  onSubmit: (event: FormEvent) => void;
  title: string;
}) {
  return <form className="rounded-2xl border border-primary/20 bg-surface p-4 shadow-panel" onSubmit={onSubmit}>
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">{title}</h2><button aria-label="Cerrar formulario" className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted" onClick={onCancel} type="button"><X className="h-5 w-5" /></button></div>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="contact-name">Nombre</Label><Input id="contact-name" maxLength={120} onChange={(event) => onChange({ ...draft, name: event.target.value })} placeholder="Nombre del contacto" required value={draft.name} /></div>
      <div className="space-y-2"><Label htmlFor="contact-phone">Teléfono</Label><Input id="contact-phone" inputMode="tel" maxLength={32} onChange={(event) => onChange({ ...draft, phone: event.target.value })} placeholder="0412 555 1234 o +1…" required value={draft.phone} /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="contact-relationship">Relación o etiqueta <span className="font-normal text-muted-foreground">(opcional)</span></Label><Input id="contact-relationship" maxLength={80} onChange={(event) => onChange({ ...draft, relationshipLabel: event.target.value })} placeholder="Ej. Hija, médico, plomería" value={draft.relationshipLabel} /></div>
    </div>
    <label className="mt-4 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-muted px-4"><input checked={draft.isFavorite} className="h-5 w-5 accent-[#1446cc]" onChange={(event) => onChange({ ...draft, isFavorite: event.target.checked })} type="checkbox" /><Star className="h-4 w-4 text-amber-500" /><span className="font-semibold">Marcar como favorito</span></label>
    <Button className="mt-4 h-12 w-full rounded-xl" disabled={isSaving} type="submit">{isSaving ? "Guardando…" : "Guardar contacto"}</Button>
  </form>;
}

function ImportReview({
  items,
  onCancel,
  onSave,
  saving,
}: {
  items: ImportReviewItem[];
  onCancel: () => void;
  onSave: (selected: ImportReviewItem[]) => void;
  saving: boolean;
}) {
  const [selectedKeys, setSelectedKeys] = useState(() => new Set(items.filter((item) => !item.duplicate).map((item) => item.key)));
  const selected = items.filter((item) => selectedKeys.has(item.key) && !item.duplicate);
  return <section aria-labelledby="import-review-title" className="rounded-2xl border border-primary/20 bg-surface p-4 shadow-panel">
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold" id="import-review-title">Revisa antes de importar</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">Solo se guardarán nombre y teléfono de los contactos que selecciones.</p></div><button aria-label="Cancelar importación" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted" onClick={onCancel} type="button"><X className="h-5 w-5" /></button></div>
    <div className="mt-4 max-h-[24rem] space-y-2 overflow-y-auto">
      {items.map((item) => <label className={cn("flex min-h-16 items-center gap-3 rounded-xl border p-3", item.duplicate ? "cursor-not-allowed border-border bg-muted/60 opacity-70" : "cursor-pointer border-border bg-background")} key={item.key}>
        <input aria-label={`Importar ${item.name}`} checked={selectedKeys.has(item.key) && !item.duplicate} className="h-5 w-5 accent-[#1446cc]" disabled={item.duplicate} onChange={(event) => setSelectedKeys((current) => { const next = new Set(current); if (event.target.checked) next.add(item.key); else next.delete(item.key); return next; })} type="checkbox" />
        <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{item.name}</span><span className="block text-sm text-muted-foreground">{formatPhoneForDisplay(item.normalizedPhone)}</span></span>
        {item.duplicate ? <span className="rounded-full bg-secondary px-2 py-1 text-xs font-bold text-primary">Ya existe</span> : <Check className="h-4 w-4 text-accent" />}
      </label>)}
    </div>
    {items.length === 0 ? <p className="mt-5 rounded-xl bg-muted p-4 text-sm text-muted-foreground">El archivo no contiene contactos con nombre y teléfono válidos.</p> : null}
    <Button className="mt-4 h-12 w-full rounded-xl" disabled={saving || selected.length === 0} onClick={() => onSave(selected)} type="button">{saving ? "Importando…" : `Importar ${selected.length || ""} ${selected.length === 1 ? "contacto" : "contactos"}`}</Button>
    <button className="mt-2 min-h-11 w-full font-semibold text-muted-foreground" disabled={saving} onClick={onCancel} type="button">Cancelar</button>
  </section>;
}

export function ResidentContactsManager({ initialContacts }: { initialContacts: ResidentContactRecord[] }) {
  const [contacts, setContacts] = useState(() => sortContacts(initialContacts));
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [draft, setDraft] = useState<ContactDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [reviewItems, setReviewItems] = useState<ImportReviewItem[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contactsManager = typeof navigator !== "undefined" ? (navigator as Navigator & { contacts?: ContactsManager }).contacts : undefined;

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es-VE");
    return contacts.filter((contact) => (!favoritesOnly || contact.is_favorite) && (!needle || `${contact.name} ${contact.relationship_label ?? ""} ${contact.phone}`.toLocaleLowerCase("es-VE").includes(needle)));
  }, [contacts, favoritesOnly, query]);

  function beginReview(imported: ImportedContact[]) {
    setReviewItems(prepareImportReview(imported, contacts.map((contact) => contact.normalized_phone)));
    setShowForm(false);
    setMessage(null);
  }

  async function chooseFromDevice() {
    if (!contactsManager) return;
    setMessage(null);
    try {
      const result = await pickDeviceContacts(contactsManager);
      if (result.status === "cancelled") { setMessage({ text: "Importación cancelada. No se guardó ningún contacto." }); return; }
      beginReview(result.contacts);
    } catch {
      setMessage({ text: "No pudimos abrir los contactos del dispositivo. Puedes usar un archivo vCard o agregarlos manualmente.", error: true });
    }
  }

  async function readVCard(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLocaleLowerCase().endsWith(".vcf") && file.type !== "text/vcard") { setMessage({ text: "Selecciona un archivo vCard con extensión .vcf.", error: true }); return; }
    try { beginReview(parseVCard(await file.text())); }
    catch { setMessage({ text: "No pudimos leer ese archivo vCard.", error: true }); }
  }

  async function saveImported(selected: ImportReviewItem[]) {
    setIsSaving(true); setMessage(null);
    try {
      const response = await fetch("/api/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contacts: selected.map((item) => ({ name: item.name, phone: item.phone, source: item.source })) }) });
      const payload = await readPayload<{ contacts?: ResidentContactRecord[] }>(response);
      if (!response.ok || !payload.contacts) throw new Error(payload.error || "No fue posible importar los contactos.");
      setContacts((current) => sortContacts([...current, ...payload.contacts!])); setReviewItems(null);
      setMessage({ text: `${payload.contacts.length} ${payload.contacts.length === 1 ? "contacto importado" : "contactos importados"}.` });
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : "No fue posible importar los contactos.", error: true }); }
    finally { setIsSaving(false); }
  }

  async function saveDraft(event: FormEvent) {
    event.preventDefault(); setIsSaving(true); setMessage(null);
    try {
      const response = await fetch(editingId ? `/api/contacts/${editingId}` : "/api/contacts", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingId ? draft : { contacts: [{ ...draft, source: "manual" }] }) });
      const payload = await readPayload<{ contact?: ResidentContactRecord; contacts?: ResidentContactRecord[] }>(response);
      if (!response.ok) throw new Error(payload.error || "No fue posible guardar el contacto.");
      const saved = payload.contact ?? payload.contacts?.[0];
      if (!saved) throw new Error("No fue posible guardar el contacto.");
      setContacts((current) => sortContacts(editingId ? current.map((contact) => contact.id === saved.id ? saved : contact) : [...current, saved]));
      setDraft(emptyDraft); setEditingId(null); setShowForm(false); setMessage({ text: editingId ? "Contacto actualizado." : "Contacto guardado." });
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : "No fue posible guardar el contacto.", error: true }); }
    finally { setIsSaving(false); }
  }

  async function toggleFavorite(contact: ResidentContactRecord) {
    setMessage(null);
    try {
      const response = await fetch(`/api/contacts/${contact.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isFavorite: !contact.is_favorite }) });
      const payload = await readPayload<{ contact?: ResidentContactRecord }>(response);
      if (!response.ok || !payload.contact) throw new Error(payload.error || "No fue posible cambiar el favorito.");
      setContacts((current) => sortContacts(current.map((item) => item.id === contact.id ? payload.contact! : item)));
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : "No fue posible cambiar el favorito.", error: true }); }
  }

  async function removeContact(contact: ResidentContactRecord) {
    if (!window.confirm(`¿Eliminar a ${contact.name} de tus contactos?`)) return;
    setMessage(null);
    try {
      const response = await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
      const payload = await readPayload<Record<string, never>>(response);
      if (!response.ok) throw new Error(payload.error || "No fue posible eliminar el contacto.");
      setContacts((current) => current.filter((item) => item.id !== contact.id)); setMessage({ text: "Contacto eliminado." });
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : "No fue posible eliminar el contacto.", error: true }); }
  }

  function editContact(contact: ResidentContactRecord) {
    setDraft({ name: contact.name, phone: contact.phone, relationshipLabel: contact.relationship_label ?? "", isFavorite: contact.is_favorite });
    setEditingId(contact.id); setShowForm(true); setReviewItems(null); setMessage(null);
  }

  return <section className="min-h-[100dvh] bg-background">
    <ResidentPageHeader subtitle="Privados y visibles solo para ti" title="Contactos frecuentes" />
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-4 sm:px-6 md:py-6">
      <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><input aria-label="Buscar contactos" className="h-14 w-full rounded-2xl border-0 bg-muted pl-12 pr-4 text-base outline-none ring-primary/25 focus:ring-2" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, relación o teléfono" type="search" value={query} /></div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Button className="h-14 rounded-2xl" onClick={() => { setDraft(emptyDraft); setEditingId(null); setShowForm(true); setReviewItems(null); }}><Plus className="h-5 w-5" /> Agregar manualmente</Button>
        {contactsManager ? <Button className="h-14 rounded-2xl" onClick={() => void chooseFromDevice()} variant="secondary"><Download className="h-5 w-5" /> Elegir del teléfono</Button> : <div className="flex min-h-14 items-center rounded-2xl bg-muted px-4 text-sm font-medium text-muted-foreground"><Download className="mr-2 h-5 w-5 shrink-0" /> Selector no disponible</div>}
        <Button className="h-14 rounded-2xl" onClick={() => fileInputRef.current?.click()} variant="outline"><FileUp className="h-5 w-5" /> Importar .vcf</Button>
        <input accept=".vcf,text/vcard,text/x-vcard" className="sr-only" onChange={(event) => void readVCard(event)} ref={fileInputRef} type="file" />
      </div>

      <div className="flex gap-3 rounded-2xl bg-secondary p-4 text-sm leading-5 text-muted-foreground"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" /><p>Ventry solicita únicamente nombre y teléfono después de tu acción. Revisas y eliges antes de guardar; no copiamos la agenda completa ni enviamos contactos a terceros.</p></div>
      {message ? <p className={cn("rounded-xl px-4 py-3 text-sm font-medium", message.error ? "bg-danger/10 text-danger" : "bg-emerald-50 text-emerald-800")} role={message.error ? "alert" : "status"}>{message.text}</p> : null}
      {showForm ? <ContactForm draft={draft} isSaving={isSaving} onCancel={() => { setShowForm(false); setEditingId(null); setDraft(emptyDraft); }} onChange={setDraft} onSubmit={(event) => void saveDraft(event)} title={editingId ? "Editar contacto" : "Nuevo contacto"} /> : null}
      {reviewItems ? <ImportReview items={reviewItems} onCancel={() => setReviewItems(null)} onSave={(selected) => void saveImported(selected)} saving={isSaving} /> : null}

      <div className="flex min-h-11 items-center justify-between gap-3"><h2 className="text-lg font-bold">{filtered.length === 1 ? "1 contacto" : `${filtered.length} contactos`}</h2><button aria-pressed={favoritesOnly} className={cn("inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold", favoritesOnly ? "bg-amber-50 text-amber-700" : "text-muted-foreground hover:bg-muted")} onClick={() => setFavoritesOnly((value) => !value)} type="button"><Star className={cn("h-4 w-4", favoritesOnly && "fill-current")} /> Solo favoritos</button></div>

      {filtered.length ? <div className="space-y-2">{filtered.map((contact, index) => <article className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-[0_5px_16px_rgba(12,18,33,0.035)] sm:p-4" key={contact.id}>
        <span aria-hidden="true" className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold", avatarColors[index % avatarColors.length])}>{contact.name.trim().charAt(0).toLocaleUpperCase("es-VE")}</span>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><h3 className="truncate font-bold">{contact.name}</h3>{contact.is_favorite ? <Star aria-label="Favorito" className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" /> : null}</div><p className="truncate text-sm text-muted-foreground">{contact.relationship_label || formatPhoneForDisplay(contact.phone)}</p><p className="text-xs text-muted-foreground">{contact.invitation_count === 1 ? "1 invitación creada" : `${contact.invitation_count} invitaciones creadas`}</p></div>
        <div className="flex shrink-0 items-center gap-1"><Link aria-label={`Invitar a ${contact.name}`} className="inline-flex min-h-12 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-bold text-white" href={`/app/invitations/new?contactId=${encodeURIComponent(contact.id)}`}><UserPlus className="h-4 w-4" /><span className="hidden sm:inline">Invitar</span></Link><button aria-label={contact.is_favorite ? `Quitar ${contact.name} de favoritos` : `Marcar ${contact.name} como favorito`} className="flex h-11 w-11 items-center justify-center rounded-xl text-amber-500 hover:bg-amber-50" onClick={() => void toggleFavorite(contact)} type="button"><Star className={cn("h-4 w-4", contact.is_favorite && "fill-current")} /></button><button aria-label={`Editar ${contact.name}`} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted" onClick={() => editContact(contact)} type="button"><Pencil className="h-4 w-4" /></button><button aria-label={`Eliminar ${contact.name}`} className="flex h-11 w-11 items-center justify-center rounded-xl text-danger hover:bg-danger/10" onClick={() => void removeContact(contact)} type="button"><Trash2 className="h-4 w-4" /></button></div>
      </article>)}</div> : <div className="rounded-2xl border border-dashed border-border bg-surface px-5 py-12 text-center"><Star className="mx-auto h-9 w-9 text-muted-foreground" /><h2 className="mt-4 font-bold">{contacts.length === 0 ? "Aún no tienes contactos" : "Sin coincidencias"}</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-5 text-muted-foreground">{contacts.length === 0 ? "Agrega uno manualmente o elige contactos de forma explícita desde tu dispositivo o un archivo vCard." : "Prueba con otra búsqueda o desactiva el filtro de favoritos."}</p></div>}
    </div>
  </section>;
}
