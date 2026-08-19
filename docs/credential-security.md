# Seguridad de credenciales y acceso atomico

Esta guia corresponde a `202608180002_credential_security_atomic_access.sql`. La migracion no fue aplicada desde esta tarea. Debe probarse primero en una copia descartable y luego en staging con aprobacion humana; produccion requiere otra decision explicita.

## Credenciales nuevas

- Los PIN de invitacion conservan seis digitos y los PIN compartidos de evento conservan ocho. Ambos se generan con `node:crypto.randomInt`; no son contrasenas de usuario.
- Cada QR nuevo es una cadena base64url de 32 bytes aleatorios (256 bits). El bitmap QR codifica solamente esa cadena: no contiene `communityId`, `invitationId`, `eventId`, nombre, telefono ni otra PII.
- `access_credentials` y `event_credentials` guardan para version 2 un hash bcrypt, un identificador aleatorio de auditoria y ningun valor recuperable. Los inserts directos autenticados quedan revocados; los RPC de emision comprueban autorizacion y colisiones dentro de la comunidad.
- El valor recuperable vive en `credential_secrets`, una tabla con RLS habilitado, sin policies y sin grants para `anon` o `authenticated`. Solo RPC `security definer` estrechos lo leen para el propietario autorizado o para una ruta publica que ya presente el `share_token` correcto.

### Threat model del valor recuperable

El producto necesita volver a mostrar y compartir PIN/QR, por lo que una copia recuperable sigue siendo necesaria. La frontera implementada protege contra clientes Supabase directos, RLS ordinaria, guardias y consultas accidentales de las tablas de negocio. No protege contra el propietario de la base, `service_role`, una copia de respaldo comprometida ni una persona que ya posea el enlace publico o la credencial. `credential_secrets` no se cifra con una clave de aplicacion para evitar introducir una clave persistida junto a los datos; si el modelo de amenaza incluye administradores o respaldos de base, el siguiente paso es cifrado de sobre o Supabase Vault con rotacion y recuperacion operativa probadas.

Los enlaces publicos son capacidades bearer. Deben viajar solo por HTTPS, no incluirse en analitica, referers externos ni logs de proxy, y revocarse cuando el acceso deje de ser valido. No habilitar logging de parametros/cuerpos de PostgREST para los RPC de credenciales.

## Compatibilidad con credenciales anteriores

La migracion no elimina ni rota accesos activos:

- las filas existentes quedan como `credential_version = 1`;
- se les agrega bcrypt y un `credential_audit_id` aleatorio;
- un QR legado sigue aceptando tanto su `qr_payload` estructurado como su antiguo `credential_value`;
- PIN y QR version 1 siguen mostrandose desde las columnas historicas;
- solo las credenciales creadas despues del despliegue usan el almacen privado version 2.

Esto mantiene activos los accesos emitidos, pero sus valores legados siguen presentes bajo el modelo RLS historico hasta que sean usados, revocados o rotados. No hay invalidacion automatica. Conviene medir cuantas filas version 1 quedan y definir una ventana de rotacion separada antes de eliminar las columnas antiguas.

Los RPC `match_invitation_credential` y `match_event_credential` se conservan para una posible reversion de codigo, pero se revoca su ejecucion a `authenticated` porque no tienen rate limiting. La aplicacion y la migracion deben desplegarse en la misma ventana.

## Validacion, rate limiting y auditoria

`validate_access_credential` hace en Postgres la busqueda tenant-scoped, el calculo de ventana en `communities.time_zone`, el rate limiting y el evento de auditoria. La respuesta nunca incluye la fila de credencial ni el valor enviado.

El limite usa `credential_rate_limits`, no memoria del proceso ni cookies como contador. La clave combina:

- comunidad;
- `auth.uid()` del admin/guardia;
- hash SHA-256 del identificador aleatorio de dispositivo guardado en cookie HttpOnly;
- hash SHA-256 del origen de red entregado por el proxy.

Tras cinco fallos dentro de diez minutos, la combinacion queda bloqueada quince minutos. Solo una credencial activa reinicia el contador: una credencial programada, vencida, revocada o usada cuenta como rechazo, de modo que un codigo antiguo no permite alternar intentos indefinidamente. La cookie de dispositivo solo se reutiliza si conserva el formato aleatorio emitido por el servidor; si fue manipulada, se rota. La aplicacion responde `429` con `Retry-After`. El proxy de staging/produccion debe sobrescribir `X-Forwarded-For` o `X-Real-IP`; no debe aceptar esos headers directamente desde Internet. Se puede purgar periodicamente solo estado antiguo, por ejemplo filas con `last_attempt_at < now() - interval '30 days'`, mediante un job aprobado por operaciones.

Los eventos guardan `credentialType`, `result` y un `credentialRef` aleatorio no derivado del secreto. La migracion redacta claves historicas conocidas (`pin`, `qr`, `credentialValue`, `qrPayload` y variantes) de forma recursiva y un trigger rechaza nuevas escrituras que intenten reintroducirlas.

## Registro atomico e idempotente

`register_invitation_entry` y `register_event_guest_entry` ejecutan dentro de una sola transaccion de Postgres:

1. verifican el rol y la comunidad;
2. reutilizan una entrada existente si llega la misma idempotency key;
3. bloquean la invitacion o el evento/invitado con `FOR UPDATE`;
4. calculan la ventana con la zona IANA de la comunidad;
5. crean `visitor_entries`;
6. actualizan `invitations` o `event_guests`;
7. crean actividad y `access_events`.

Un indice unico por `(community_id, idempotency_key)` y el bloqueo de la credencial de un uso cubren reintentos iguales y solicitudes simultaneas con claves distintas. Validar sigue separado de registrar para conservar la UX de escaneo/lista, pero registrar vuelve a comprobar estado y ventana sin confiar en la respuesta previa.

## Pasos manuales

1. Crear snapshot restaurable de staging y desplegar aplicacion+migracion en una ventana coordinada.
2. Ejecutar un dry-run de migraciones y revisar que solo se agregue `202608180002_credential_security_atomic_access.sql`.
3. Revisar y ajustar `communities.time_zone`; las filas existentes reciben `America/Caracas`.
4. Aplicar manualmente en staging, nunca desde esta tarea.
5. Ejecutar:

   ```powershell
   psql $env:LOCAL_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/tests/rls_multi_tenant.sql
   psql $env:LOCAL_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/tests/credential_access_security.sql
   psql $env:LOCAL_DATABASE_URL -v ON_ERROR_STOP=1 -v TEST_DATABASE_URL=$env:LOCAL_DATABASE_URL -f supabase/tests/credential_entry_concurrency.sql
   ```

6. Probar manualmente un PIN/QR legado activo, un PIN/QR version 2, el escaner `@zxing`, invitaciones publicas, Event Mode y un reintento con la misma `Idempotency-Key`.
7. Confirmar que `access_events.details` no contiene valores reutilizables y que guardias/clientes directos no pueden leer `credential_secrets`.
8. Programar, con aprobacion operativa, retencion de rate limits y rotacion gradual de credenciales version 1.
