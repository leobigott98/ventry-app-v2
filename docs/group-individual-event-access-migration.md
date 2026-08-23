# Migracion de grupos y accesos individuales

Archivo: `supabase/migrations/202608210001_group_individual_event_access.sql`.

No se aplica automaticamente. La migracion conserva invitaciones existentes sin grupo y eventos existentes con `credential_mode = shared`; solo los eventos creados por el flujo nuevo usan `individual`.

## Aplicacion manual

1. Crear un respaldo y confirmar que `202608200001_event_planned_exit.sql` ya esta aplicado.
2. Probar en Supabase local: `supabase db reset`.
3. Ejecutar las pruebas SQL, incluida `supabase/tests/group_individual_event_access.sql`.
4. Revisar RLS y grants con usuarios reales de prueba admin, guard y resident en dos comunidades.
5. Programar la aplicacion en staging y luego produccion mediante el procedimiento humano habitual. No usar `db push` desde una sesion enlazada sin esa aprobacion.

## Contenido

- `invitation_groups` y relacion nullable `invitations.group_id`.
- Telefono opcional por invitacion del grupo.
- `resident_events.credential_mode` compatible con eventos compartidos historicos.
- Credenciales y secretos individuales separados, sin grants directos sobre secretos.
- Token publico opaco por invitado y RPC publica minimizada.
- Reglas de acompanantes y conteo persistido en `visitor_entries`.
- RPC transaccionales de creacion, revocacion grupal, validacion exacta, entrada idempotente y widget paginado de garita.
- Claves idempotentes y huellas del payload para que un reintento de creacion devuelva el mismo grupo o evento sin duplicarlo.
- Generacion de PIN con aritmetica `bigint`; evita desbordamiento de 32 bits al crear grupos o eventos grandes.
- La entrada por evento exige una validacion exitosa reciente del mismo guardia y, para credenciales individuales, del invitado exacto.

## Rollback

`supabase/rollback/202608210001_group_individual_event_access.down.sql` elimina datos nuevos. Despues se deben restaurar las definiciones previas de las RPC publicas re-aplicando las migraciones de seguridad indicadas en el archivo. Es una operacion destructiva para grupos y credenciales individuales y requiere respaldo y ventana de mantenimiento.
