"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { ResidentPageHeader } from "@/components/resident/resident-header";
import { Button } from "@/components/ui/button";

export default function ContactsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="min-h-[100dvh]"><ResidentPageHeader title="Contactos frecuentes" /><div className="mx-auto max-w-xl px-5 py-12 text-center"><AlertTriangle className="mx-auto h-10 w-10 text-danger" /><h2 className="mt-4 text-xl font-bold">No pudimos cargar tus contactos</h2><p className="mt-2 text-sm text-muted-foreground">No se modificó ninguna información.</p><Button className="mt-6" onClick={reset}><RotateCcw className="h-4 w-4" /> Reintentar</Button></div></section>;
}
