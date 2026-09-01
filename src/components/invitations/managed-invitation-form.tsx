"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { FormMessage } from "@/components/forms/form-message";
import { ArrivalWindowFields, type ArrivalWindowEditorValue } from "@/components/invitations/arrival-window-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { InvitationAccessType } from "@/lib/domain/types";

export function ManagedInvitationForm({ invitation }: { invitation: {
  id:string; version:number; visitor_name:string|null; visitor_phone:string|null; resident_contact_id:string|null; access_type:InvitationAccessType; notes:string|null;
  visit_date:string; arrival_window_mode?:"all_day"|"from_time"|null; arrival_start?:string|null; arrival_end_date?:string|null; arrival_end?:string|null; planned_exit_date?:string|null; planned_exit_time?:string|null;
}}) {
  const router=useRouter(); const key=useRef(crypto.randomUUID());
  const [name,setName]=useState(invitation.visitor_name??""); const [phone,setPhone]=useState(invitation.visitor_phone??""); const [contactId,setContactId]=useState(invitation.resident_contact_id);
  const [accessType,setAccessType]=useState<InvitationAccessType>(invitation.access_type); const [notes,setNotes]=useState(invitation.notes??"");
  const [arrival,setArrival]=useState<ArrivalWindowEditorValue>({date:invitation.visit_date,arrivalWindowMode:invitation.arrival_window_mode??"all_day",arrivalStart:invitation.arrival_start??null,arrivalEndDate:invitation.arrival_end_date??null,arrivalEnd:invitation.arrival_end??null,plannedExitDate:invitation.planned_exit_date??null,plannedExitTime:invitation.planned_exit_time??null});
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState<{text:string;error?:boolean}|null>(null);
  async function submit(event:React.FormEvent){event.preventDefault();if(busy)return;setBusy(true);setMessage(null);try{const response=await fetch(`/api/invitations/${invitation.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({expectedVersion:invitation.version,idempotencyKey:key.current,visitorName:name||null,visitorPhone:phone||null,residentContactId:contactId,accessType,notes:notes||null,visitDate:arrival.date,arrivalWindowMode:arrival.arrivalWindowMode,arrivalStart:arrival.arrivalStart,arrivalEndDate:arrival.arrivalEndDate,arrivalEnd:arrival.arrivalEnd,plannedExitDate:arrival.plannedExitDate,plannedExitTime:arrival.plannedExitTime})});const payload=await response.json().catch(()=>({})) as{error?:string};if(!response.ok){setMessage({text:payload.error??"No fue posible guardar los cambios.",error:true});return;}setMessage({text:"Invitación actualizada."});router.refresh();}catch{setMessage({text:"No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.",error:true});}finally{setBusy(false);}}
  return <form className="min-w-0 space-y-5" onSubmit={submit}>
    <p className="rounded-xl bg-secondary p-3 text-sm text-muted-foreground">Si cambias el nombre, teléfono o contacto, la credencial anterior se invalida y se genera una nueva.</p>
    <div className="space-y-2"><Label htmlFor={`managed-name-${invitation.id}`}>Nombre</Label><Input id={`managed-name-${invitation.id}`} required={accessType!=="delivery"} value={name} onChange={(event)=>{setName(event.target.value);setContactId(null);}} /></div>
    <div className="space-y-2"><Label htmlFor={`managed-phone-${invitation.id}`}>Teléfono</Label><Input id={`managed-phone-${invitation.id}`} inputMode="tel" value={phone} onChange={(event)=>{setPhone(event.target.value);setContactId(null);}} /></div>
    {contactId ? <p className="text-xs text-muted-foreground">Vinculado a un contacto guardado. Editar identidad quitará ese vínculo.</p>:null}
    <div className="space-y-2"><Label htmlFor={`managed-type-${invitation.id}`}>Tipo de visita</Label><select className="h-12 w-full rounded-md border border-border bg-surface px-3" id={`managed-type-${invitation.id}`} value={accessType} onChange={(event)=>setAccessType(event.target.value as InvitationAccessType)}><option value="visitor">Visita</option><option value="delivery">Entrega</option><option value="service_provider">Proveedor</option><option value="frequent_visitor">Visitante frecuente</option></select></div>
    <ArrivalWindowFields idPrefix={`managed-invitation-${invitation.id}`} value={arrival} onChange={(field,value)=>setArrival((current)=>({...current,[field]:value}))} />
    <div className="space-y-2"><Label htmlFor={`managed-notes-${invitation.id}`}>Notas</Label><Textarea id={`managed-notes-${invitation.id}`} maxLength={500} value={notes} onChange={(event)=>setNotes(event.target.value)} /></div>
    <FormMessage message={message?.text??null} variant={message?.error?"error":"success"}/><Button className="w-full sm:w-auto" disabled={busy} type="submit">{busy?"Guardando…":message?.error?"Reintentar":"Guardar cambios"}</Button>
  </form>;
}
