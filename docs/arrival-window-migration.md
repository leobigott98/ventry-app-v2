# Ventanas de llegada: despliegue y backfill

La migración `202608260001_arrival_windows.sql` añade el modelo explícito de llegada sin borrar las columnas anteriores. Las columnas `window_*` continúan como proyección compatible para clientes y RPC desplegados durante una transición.

## Consulta previa

Ejecutar antes de aplicar la migración y conservar el resultado para revisión humana:

```sql
select 'invitations' as source, count(*) as indefinite_rows
from public.invitations where no_time_limit = true
union all
select 'invitation_groups', count(*)
from public.invitation_groups where no_time_limit = true;
```

Las filas finitas se copian sin cambiar sus instantes. Las filas con `no_time_limit=true` quedan con `legacy_indefinite=true` y sin `arrival_window_mode`; no se reinterpretan como “todo el día”. Deben revisarse con el residente, revocarse o migrarse manualmente a una ventana finita.

Toda escritura posterior, incluso desde un cliente anterior, se normaliza a una ventana finita. “Todo el día” termina a las `23:59:59.999999` de la fecha local de la comunidad. No representa visitantes frecuentes ni autorizaciones permanentes.

## Orden de despliegue

1. Ejecutar la consulta previa y asignar responsable a las filas legacy.
2. Aplicar la migración en una ventana controlada.
3. Desplegar la aplicación que llama las RPC `create_arrival_*`.
4. Revisar `legacy_indefinite=true`; no eliminarlas sin decisión humana.
5. Cuando el inventario legacy llegue a cero, una migración futura podrá retirar `no_time_limit` y las RPC antiguas.

El rollback conserva los valores históricos de `window_*` y elimina solamente la capa explícita nueva. No revierte decisiones manuales ya efectuadas sobre credenciales legacy.
