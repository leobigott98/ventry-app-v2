"use client";

import { Clock3, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ArrivalWindowMode } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export type ArrivalWindowEditorValue = {
  date: string;
  arrivalWindowMode: ArrivalWindowMode | null;
  arrivalStart: string | null;
  arrivalEndDate: string | null;
  arrivalEnd: string | null;
  plannedExitDate: string | null;
  plannedExitTime: string | null;
};

type FieldName = keyof ArrivalWindowEditorValue;

export function ArrivalWindowFields({
  errors = {},
  idPrefix,
  minDate,
  onChange,
  value,
}: {
  errors?: Partial<Record<FieldName, string>>;
  idPrefix: string;
  minDate?: string;
  onChange: <K extends FieldName>(field: K, value: ArrivalWindowEditorValue[K]) => void;
  value: ArrivalWindowEditorValue;
}) {
  const hasArrivalEnd = Boolean(value.arrivalEndDate || value.arrivalEnd);
  const hasPlannedExit = Boolean(value.plannedExitDate || value.plannedExitTime);
  const error = (field: FieldName) => errors[field] ? <p className="text-sm font-medium text-danger" role="alert">{errors[field]}</p> : null;

  function selectMode(mode: ArrivalWindowMode) {
    onChange("arrivalWindowMode", mode);
    if (mode === "all_day") {
      onChange("arrivalStart", null);
      onChange("arrivalEndDate", null);
      onChange("arrivalEnd", null);
    }
  }

  return <div className="min-w-0 max-w-full space-y-6">
    <div className="space-y-2">
      <Label className="font-bold" htmlFor={`${idPrefix}-date`}>Fecha de visita</Label>
      <Input className="h-14 w-full min-w-0 max-w-full text-base" id={`${idPrefix}-date`} min={minDate} type="date" value={value.date} onChange={(event) => onChange("date", event.target.value)} />
      {error("date")}
    </div>

    <fieldset>
      <legend className="font-bold">Modalidad de llegada</legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className={cn("flex min-h-20 cursor-pointer items-start gap-3 rounded-2xl border-2 p-4", value.arrivalWindowMode === "all_day" ? "border-primary bg-secondary/60" : "border-border bg-surface")}>
          <input checked={value.arrivalWindowMode === "all_day"} className="mt-1 h-5 w-5 accent-[#1446cc]" name={`${idPrefix}-mode`} onChange={() => selectMode("all_day")} type="radio" />
          <span><span className="block font-bold">Todo el día</span><span className="mt-1 block text-sm text-muted-foreground">Puede llegar durante el día indicado; vence al terminar ese día local.</span></span>
        </label>
        <label className={cn("flex min-h-20 cursor-pointer items-start gap-3 rounded-2xl border-2 p-4", value.arrivalWindowMode === "from_time" ? "border-primary bg-secondary/60" : "border-border bg-surface")}>
          <input checked={value.arrivalWindowMode === "from_time"} className="mt-1 h-5 w-5 accent-[#1446cc]" name={`${idPrefix}-mode`} onChange={() => selectMode("from_time")} type="radio" />
          <span><span className="block font-bold">Elegir horario de llegada</span><span className="mt-1 block text-sm text-muted-foreground">Define desde qué hora puede presentarse.</span></span>
        </label>
      </div>
    </fieldset>

    {value.arrivalWindowMode === "from_time" ? <div className="space-y-4 rounded-2xl bg-surface p-4">
      <div className="space-y-2"><Label htmlFor={`${idPrefix}-start`}>Puede llegar desde</Label><Input className="h-14 text-base" id={`${idPrefix}-start`} type="time" value={value.arrivalStart ?? ""} onChange={(event) => onChange("arrivalStart", event.target.value || null)} />{error("arrivalStart")}</div>
      {!hasArrivalEnd ? <Button className="min-h-11" onClick={() => { onChange("arrivalEndDate", value.date); onChange("arrivalEnd", null); }} type="button" variant="ghost"><Plus className="h-4 w-4" /> Agregar hora límite</Button> : <fieldset className="min-w-0 max-w-full space-y-3"><legend className="font-semibold">Hora límite de llegada</legend><div className="grid min-w-0 max-w-full gap-3 sm:grid-cols-2"><div className="min-w-0 space-y-2"><Label htmlFor={`${idPrefix}-end-date`}>Fecha</Label><Input className="h-14 w-full min-w-0 max-w-full" id={`${idPrefix}-end-date`} min={value.date} type="date" value={value.arrivalEndDate ?? ""} onChange={(event) => onChange("arrivalEndDate", event.target.value || null)} />{error("arrivalEndDate")}</div><div className="min-w-0 space-y-2"><Label htmlFor={`${idPrefix}-end`}>Hora</Label><Input className="h-14 w-full min-w-0 max-w-full" id={`${idPrefix}-end`} type="time" value={value.arrivalEnd ?? ""} onChange={(event) => onChange("arrivalEnd", event.target.value || null)} />{error("arrivalEnd")}</div></div><Button className="min-h-11" onClick={() => { onChange("arrivalEndDate", null); onChange("arrivalEnd", null); }} type="button" variant="ghost"><X className="h-4 w-4" /> Quitar hora límite</Button></fieldset>}
    </div> : null}

    {!hasPlannedExit ? <Button className="min-h-12 w-full min-w-0 max-w-full justify-start rounded-2xl border-dashed" onClick={() => { onChange("plannedExitDate", value.date); onChange("plannedExitTime", null); }} type="button" variant="outline"><Clock3 className="h-5 w-5" /> Agregar salida prevista</Button> : <fieldset className="min-w-0 max-w-full rounded-2xl border border-border bg-surface p-4"><legend className="px-1 font-bold">Salida prevista</legend><p className="mb-3 text-sm text-muted-foreground">Es informativa y no modifica la vigencia de llegada.</p><div className="grid min-w-0 max-w-full gap-3 sm:grid-cols-2"><div className="min-w-0 space-y-2"><Label htmlFor={`${idPrefix}-exit-date`}>Fecha</Label><Input className="h-14 w-full min-w-0 max-w-full" id={`${idPrefix}-exit-date`} min={value.date} type="date" value={value.plannedExitDate ?? ""} onChange={(event) => onChange("plannedExitDate", event.target.value || null)} />{error("plannedExitDate")}</div><div className="min-w-0 space-y-2"><Label htmlFor={`${idPrefix}-exit-time`}>Hora</Label><Input className="h-14 w-full min-w-0 max-w-full" id={`${idPrefix}-exit-time`} type="time" value={value.plannedExitTime ?? ""} onChange={(event) => onChange("plannedExitTime", event.target.value || null)} />{error("plannedExitTime")}</div></div><Button className="mt-3 min-h-11" onClick={() => { onChange("plannedExitDate", null); onChange("plannedExitTime", null); }} type="button" variant="ghost"><X className="h-4 w-4" /> Quitar salida prevista</Button></fieldset>}
  </div>;
}
