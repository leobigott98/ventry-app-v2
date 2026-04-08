import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ResidentRecord, UnitRecord } from "@/lib/domain/types";
import {
  accessEventDirectionOptions,
  accessEventStatusOptions,
  invitationAccessTypeOptions,
} from "@/lib/domain/types";

type AccessLogFiltersProps = {
  values: {
    query: string;
    residentId: string;
    unitId: string;
    accessType: string;
    status: string;
    direction: string;
    dateFrom: string;
    dateTo: string;
  };
  residents: ResidentRecord[];
  units: UnitRecord[];
};

export function AccessLogFilters({ values, residents, units }: AccessLogFiltersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Busqueda y filtros</CardTitle>
        <CardDescription>
          Filtra por persona, unidad, tipo, movimiento, fecha o estado para reconstruir lo ocurrido.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" method="get">
          <div className="space-y-2">
            <Label htmlFor="accessLogQuery">Buscar</Label>
            <Input
              id="accessLogQuery"
              name="q"
              placeholder="Visitante, residente, unidad o guardia"
              defaultValue={values.query}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="residentId">Residente</Label>
              <Select id="residentId" name="residentId" defaultValue={values.residentId}>
                <option value="">Todos</option>
                {residents.map((resident) => (
                  <option key={resident.id} value={resident.id}>
                    {resident.full_name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitId">Unidad</Label>
              <Select id="unitId" name="unitId" defaultValue={values.unitId}>
                <option value="">Todas</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.building ? `${unit.building} - ` : ""}
                    {unit.identifier}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accessType">Tipo de acceso</Label>
              <Select id="accessType" name="accessType" defaultValue={values.accessType}>
                <option value="">Todos</option>
                {invitationAccessTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="direction">Movimiento</Label>
              <Select id="direction" name="direction" defaultValue={values.direction}>
                <option value="">Todos</option>
                {accessEventDirectionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select id="status" name="status" defaultValue={values.status}>
                <option value="">Todos</option>
                {accessEventStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFrom">Desde</Label>
              <Input id="dateFrom" name="dateFrom" type="date" defaultValue={values.dateFrom} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">Hasta</Label>
              <Input id="dateTo" name="dateTo" type="date" defaultValue={values.dateTo} />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit">Aplicar filtros</Button>
            <Button asChild type="button" variant="ghost">
              <Link href="/app/access-log">Limpiar</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
