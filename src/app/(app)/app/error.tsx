"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="mx-auto max-w-xl rounded-2xl border border-danger/20 bg-surface p-6 text-center shadow-panel"><AlertTriangle className="mx-auto h-9 w-9 text-danger" /><h2 className="mt-4 text-xl font-bold">No pudimos cargar esta sección</h2><p className="mt-2 text-sm text-muted-foreground">Tu información no se modificó. Puedes volver a intentarlo.</p><Button className="mt-5" onClick={reset}><RotateCcw className="h-4 w-4" /> Reintentar</Button></div>;
}
