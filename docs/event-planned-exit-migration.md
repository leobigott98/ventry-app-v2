# Salida prevista de eventos

La migración `202608200001_event_planned_exit.sql` agrega dos columnas nullable a `resident_events`:

- `planned_exit_date`
- `planned_exit_time`

Las restricciones exigen que ambas estén vacías o completas y que la salida prevista sea igual o posterior a `window_end_date + window_end`. La salida prevista es informativa: las RPC de validación y registro de entrada continúan autorizando únicamente con `event_date/window_start` y `window_end_date/window_end`.

## Aplicación manual

1. Ejecutar primero en una base local o desechable con todas las migraciones anteriores.
2. Correr `supabase/tests/event_planned_exit.sql` y `supabase/tests/credential_access_security.sql` contra esa base.
3. Revisar el diff y programar la aplicación en cada entorno mediante el proceso operativo habitual.
4. No ejecutar `db push` desde una estación no autorizada.

El rollback manual está en `supabase/rollback/202608200001_event_planned_exit.down.sql`. El rollback elimina los datos de salida prevista, por lo que requiere confirmación humana y respaldo previo.
