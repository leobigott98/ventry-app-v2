# Estado actual del repositorio

## Actualizacion de seguridad de credenciales (18 de agosto de 2026)

La rama `codex/03-credential-security`, mediante la migracion pendiente `202608180002_credential_security_atomic_access.sql`, corrige los hallazgos historicos de esta auditoria relativos a `Math.random()`, payloads QR con IDs, credenciales completas en auditoria, ausencia de rate limiting y doble entrada concurrente. Las credenciales version 1 se conservan compatibles; las version 2 usan generacion criptografica, secreto fuera de RLS ordinaria, validacion rate-limited y registro transaccional/idempotente. La ventana de garita se calcula con `communities.time_zone`. Detalles, threat model y despliegue manual: `docs/credential-security.md`.

La matriz y los riesgos debajo describen el commit auditado originalmente y se conservan como registro historico; no deben interpretarse como el estado de esta rama sin leer la actualizacion anterior.

Auditoria realizada el 17 de agosto de 2026 sobre `leobigott98/ventry-app-v2`, commit `35cb23cad41fda073dd90b52735f460f9db54f2b` de `origin/main`. La rama de trabajo estaba limpia y a `0/0` commits de `origin/main` despues de `git fetch origin main --prune`.

## Matriz de implementacion

| Area | Estado | Evidencia concreta | Alcance verificado |
| --- | --- | --- | --- |
| Next.js App Router, React, TypeScript y Tailwind | Implementado | `package.json`, `src/app/layout.tsx`, `src/app/globals.css`, `tailwind.config.ts`, `tsconfig.json` | Next.js 15, React 19, TypeScript estricto, rutas App Router y Tailwind 3. |
| Comunidades y membresias | Implementado | `supabase/migrations/202603280001_sprint1_foundation.sql`, `src/lib/domain/community.ts`, `src/app/api/community/onboarding/route.ts` | Onboarding, perfil de comunidad, unidades iniciales y membresia primaria. |
| Roles `admin`, `guard` y `resident` | Implementado | `src/lib/navigation.tsx`, `src/lib/domain/session-context.ts`, `src/lib/auth/api.ts` | Navegacion, paginas y APIs filtran roles; invitaciones y eventos de residentes se limitan por `resident_id`. |
| Supabase Auth | Parcial | `src/app/api/auth/*`, `src/lib/supabase/auth.ts`, `src/lib/auth/session.ts`, `middleware.ts` | Login, signup, recuperacion y cambio de clave llaman a Supabase. La sesion propia de la app no esta firmada ni se valida contra una sesion Supabase en cada solicitud; ver riesgos. |
| Unidades | Parcial | `src/app/(app)/app/units/*`, `src/app/api/units/*`, `src/lib/domain/mutations.ts` | Crear, listar, leer y editar; no existe eliminacion de unidades. Solo `admin`. |
| Residentes | Parcial | `src/app/(app)/app/residents/*`, `src/app/api/residents/*`, `src/lib/domain/mutations.ts`, `src/lib/domain/access.ts` | Crear, listar, leer, editar y aprovisionar acceso; no existe eliminacion de residentes. Solo `admin`. |
| Invitaciones con PIN/QR | Implementado | `src/app/(app)/app/invitations/*`, `src/components/invitations/*`, `src/lib/domain/invitations.ts`, `src/lib/domain/mutations.ts` | Creacion real, credencial PIN o QR, alcance por residente, estados efectivos e historial. |
| Ventanas, revocacion y compartir invitaciones | Implementado | `supabase/migrations/202607250001_invitation_window_options.sql`, `src/app/api/invitations/[invitationId]/{window,revoke,share}/route.ts`, `src/components/invitations/invitation-window-form.tsx`, `src/components/invitations/share-invitation-actions.tsx` | Fecha/hora final o sin limite, revocacion, WhatsApp/Web Share y registro de acciones. |
| Ruta publica de invitacion | Implementado | `src/app/invite/[shareToken]/page.tsx` | Renderiza datos reales y genera el QR con `qrcode`. |
| Event Mode e invitados | Implementado | `supabase/migrations/202607250002_resident_event_mode.sql`, `src/app/(app)/app/events/*`, `src/components/events/*`, `src/lib/domain/events.ts` | Evento con lista/importacion CSV, PIN/QR compartido, revocacion, compartir y control individual de asistencia. |
| Ruta publica de evento | Implementado | `src/app/event/[shareToken]/page.tsx` | Acceso publico por token con estado, ventana, anfitrion, unidad y credencial. |
| Garita operativa | Implementado | `src/app/(app)/app/guards/page.tsx`, `src/components/guards/guard-workspace.tsx`, `src/app/api/guards/*`, `src/lib/domain/guards.ts`, `src/lib/domain/event-access.ts` | Escaneo de camara con `@zxing/browser`, PIN, QR, busqueda, entrada/salida, eventos, no anunciados y vehiculos. Solo `admin`/`guard`. |
| Bitacora de accesos | Implementado | `supabase/migrations/202603290001_sprint5_access_audit.sql`, `src/app/(app)/app/access-log/*`, `src/components/access-log/*`, `src/lib/domain/access-log.ts` | Lista, filtros y detalle de validaciones, entradas, salidas y registros manuales. Solo `admin`/`guard`. |
| Interfaz en espanol y residente mobile-first | Implementado | `src/components/layout/app-shell.tsx`, `src/app/(app)/app/dashboard/page.tsx`, formularios en `src/components` | Navegacion inferior movil, menu compacto y contenido operativo en espanol. |
| Contactos frecuentes del residente | Ausente | No hay tabla, ruta ni componente equivalente; el ZIP los define como arreglo local en `src/app/App.tsx` | Requiere definir modelo, privacidad y origen de datos antes de implementarse. |
| Invitacion por voz | Ausente | No hay dependencia, API ni componente de captura/transcripcion de voz | El ZIP solo simula fases y un resultado fijo. |
| Llamadas garita-residente | Ausente | No hay proveedor de telefonia/WebRTC, API ni rutas asociadas | Las pantallas de llamada del ZIP son demostrativas. |
| Lint y pruebas automatizadas | Ausente | `package.json` no contiene scripts `lint` ni `test`; no hay archivos de prueba propios | El typecheck y el build son las unicas validaciones automatizadas disponibles hoy. |

## Migraciones inspeccionadas

| Migracion | Responsabilidad |
| --- | --- |
| `202603280001_sprint1_foundation.sql` | Comunidades, membresias, unidades, residentes, invitaciones, credenciales e historial. |
| `202603280002_guard_workflow.sql` | Entradas de visitantes y eventos de acceso de garita. |
| `202603280003_auth_access_foundation.sql` | Vinculos de membresias con residentes y usuarios de Supabase Auth. |
| `202603290001_sprint5_access_audit.sql` | Campos e indices para auditoria y filtros de bitacora. |
| `202607250001_invitation_window_options.sql` | Fecha final y opcion sin limite para invitaciones. |
| `202607250002_resident_event_mode.sql` | Eventos, invitados, credenciales, actividad e integracion con garita/bitacora. |

## Riesgos confirmados que requieren decision humana

| Prioridad | Riesgo confirmado | Evidencia | Decision necesaria |
| --- | --- | --- | --- |
| Alta | La cookie `ventry_session` es JSON en Base64 URL, sin firma; el middleware solo comprueba que exista. Una cookie construida manualmente puede aportar el correo de otra membresia y alcanzar la resolucion de contexto. | `src/lib/auth/session.ts`, `middleware.ts`, `src/lib/auth/api.ts` | Sustituirla por sesiones Supabase verificadas en servidor (o firmar y validar criptograficamente la sesion) antes de considerar el sistema seguro para produccion. |
| Alta | Onboarding y carga de logo autorizan `admin` leyendo directamente el rol de esa cookie. Un valor falsificado sin membresia existente puede intentar crear una comunidad o subir un archivo bajo `onboarding/<email>`. | `src/app/api/community/onboarding/route.ts`, `src/app/api/community/logo-upload/route.ts`, `src/lib/auth/request.ts` | Exigir identidad Supabase verificada y derivar el rol de una membresia confiable; separar de forma segura el caso previo al onboarding. |
| Alta | Ninguna de las seis migraciones habilita RLS ni crea politicas. La mayor parte de la capa de datos usa un cliente privilegiado de servidor y, si falta la clave privilegiada, cae a la clave anonima. | `supabase/migrations/*.sql`, `src/lib/supabase/server.ts` | Definir el modelo de autorizacion de base de datos/RLS y eliminar el fallback ambiguo; no aplicar cambios sin revision de datos y despliegue. |
| Alta | `SUPABASE_SERVICE_ROLE_KEY` se consume tanto en el cliente admin de Auth como en el cliente generico de datos. `src/lib/supabase/server.ts` no declara `server-only`, por lo que la separacion depende de disciplina de imports y del bundler. | `src/lib/supabase/auth.ts`, `src/lib/supabase/server.ts`, consumidores en `src/lib/domain/*` | Crear fronteras `server-only` explicitas y separar cliente admin de cliente autenticado; requiere una tarea de seguridad con pruebas de autorizacion. |
| Alta | `npm ci` reporta `5 high severity vulnerabilities`. | Salida de validacion del 17-08-2026; `package-lock.json` | Ejecutar y revisar `npm audit` por separado; aprobar actualizaciones segun impacto. No se ejecuto `npm audit fix`. |
| Media | El signup publico crea y confirma usuarios con metadato `admin` mediante `auth.admin.createUser`. | `src/app/api/auth/signup/route.ts` | Confirmar si el alta de comunidades debe permanecer abierta o pasar a invitacion/aprobacion. |
| Media | Los PIN se generan con `Math.random()` y no tienen unicidad global en base de datos; la busqueda toma como maximo una coincidencia. | `src/lib/domain/mutations.ts`, `src/lib/domain/events.ts`, migraciones de `access_credentials` y `event_credentials` | Elegir generador criptografico, alcance y restricciones de unicidad/rotacion. |
| Alta | La validacion guarda el PIN o payload QR completo en `access_events.details`; la respuesta de validacion tambien devuelve el registro de credencial al cliente de garita. Los intentos fallidos quedan almacenados con el valor introducido. | `src/lib/domain/mutations.ts`, `src/lib/domain/event-access.ts`, `src/lib/domain/guards.ts`, `src/app/api/guards/validate-credential/route.ts` | Redactar o hashear credenciales en auditoria y devolver una proyeccion minima; definir retencion y acceso antes de migrar datos existentes. |
| Media | Creacion de invitaciones/eventos y algunas entradas agrupan varias escrituras con compensaciones manuales, no con una transaccion de base de datos. | `src/lib/domain/mutations.ts`, `src/lib/domain/events.ts` | Decidir si mover operaciones criticas a funciones SQL/RPC transaccionales. |
| Alta | El registro de una invitacion lee estado, inserta `visitor_entries` y despues marca `used`; dos solicitudes concurrentes pueden superar la lectura y crear entradas duplicadas. Crear invitaciones/eventos tampoco acepta clave de idempotencia. Los bloqueos de UI reducen dobles clics, pero no reintentos ni concurrencia. | `src/lib/domain/mutations.ts`, `src/lib/domain/events.ts`, `src/components/guards/guard-workspace.tsx`, Route Handlers de creacion/entrada | Añadir claim atomico/constraint e idempotency key en servidor; cubrir con prueba concurrente. |
| Media | Un correo puede pertenecer a varias comunidades, pero el contexto elige una sola membresia con `limit(1)` y no ofrece selector de comunidad. | `src/lib/domain/community.ts`, indice unico por `(community_id, email)` en la migracion inicial | Definir si el producto soporta una o varias comunidades por usuario. |
| Alta | Fechas y horas de invitaciones/eventos se interpretan con `new Date('YYYY-MM-DDTHH:mm:ss')` en la zona local del proceso. En un servidor UTC, el estado `scheduled`/`expired` puede diferir de `America/Caracas`; dos vistas de bitacora tambien formatean sin `timeZone`. | `src/lib/schemas/invitations.ts`, `src/lib/schemas/events.ts`, `src/lib/domain/invitations.ts`, `src/lib/domain/events.ts`, `src/app/(app)/app/access-log/page.tsx`, `src/components/access-log/access-event-card.tsx` | Definir zona por comunidad o fijar `America/Caracas`, almacenar instantes UTC y probar limites/medianoche/DST antes de cambiar comportamiento. |
| Media | El build necesita red para descargar tres Google Fonts. | `src/app/layout.tsx` | Decidir si se mantienen fuentes remotas en build o se alojan localmente para builds reproducibles/offline. |

No se observo una referencia directa a `service_role` desde componentes cliente ni valores de secretos en el diff. La clave si se usa en un cliente generico de datos de servidor, como indica la tabla; no se inspeccionaron ni documentaron valores de archivos `.env`.

## Revision adversarial del diff documental

| Hallazgo | Severidad | Archivo | Correccion dentro de esta tarea | Prueba o evidencia |
| --- | --- | --- | --- | --- |
| El diff no modifica codigo ejecutable, estilos, migraciones ni dependencias; no introduce una regresion funcional directa. | Informativa | `AGENTS.md`, `README.md`, `docs/*` | Ninguna necesaria; se mantuvo el alcance documental. | `git diff --name-only`, `git diff --check`, typecheck y build. |
| La primera version de `AGENTS.md` no exigia lint y permitia `service_role` en cualquier modulo de servidor. | Media | `AGENTS.md` | Se exige lint y una frontera admin `server-only`; si el script no existe debe reportarse. | Revision textual y busqueda de `SUPABASE_SERVICE_ROLE_KEY`. |
| La primera matriz no registraba credenciales en bitacora/respuesta, zona horaria ni concurrencia/idempotencia. | Alta | `docs/current-state.md` | Se añadieron como riesgos confirmados con archivos y decisiones necesarias. | Trazado de `credentialValue`, `new Date(...)` y secuencias select/insert/update. |
| No hay `communityId` aceptado desde los cuerpos de las APIs sensibles; se deriva del contexto. Invitaciones/eventos de residentes sustituyen o verifican `residentId`. La cookie falsificable invalida esa garantia en el limite de sesion, y onboarding/logo confian directamente en su rol. | Alta por la cookie | `src/lib/auth/api.ts`, APIs de invitaciones/eventos/garita/comunidad, `src/lib/auth/session.ts` | El buen alcance interno se documento; la correccion de sesion/onboarding queda pendiente por estar fuera del alcance. | Inspeccion de Route Handlers y filtros `.eq('community_id', ...)`/`.eq('resident_id', ...)`. |
| El diff no agrega estados simulados, botones ni UI; por ello no cambia accesibilidad o responsive. La ausencia de pruebas UI impide certificar el comportamiento existente. | Media | Diff completo; `package.json` | Se mantiene fuera del diff cualquier control del ZIP sin backend y se declara la falta de pruebas. | Inventario de archivos cambiados y ausencia de scripts/suite. |

## Validacion ejecutada

| Comando | Resultado exacto |
| --- | --- |
| `git fetch origin main --prune` | Exito; `HEAD` y `origin/main` quedaron en `35cb23c`, diferencia `0 0`. |
| `npm ci` | Primer intento: fallo antes de iniciar npm porque el shim buscaba `C:\Users\l_a_b\AppData\Roaming\npm\node_modules\npm\bin\npm-cli.js` y el modulo no existia. Intento final con `NPM_CONFIG_PREFIX=C:\Program Files\nodejs` y cache temporal: exito, `added 160 packages, and audited 161 packages in 49s`; `5 high severity vulnerabilities`. |
| `npm run typecheck` | Exito, codigo de salida 0; `tsc --noEmit` sin diagnosticos. |
| `npm run build` | Primer intento: fallo por bloqueo de red al descargar DM Sans, IBM Plex Mono y Syne. Validacion adversarial final con red permitida: exito, codigo de salida 0; Next.js 15.5.14 compilo en 7.1 s, valido tipos y genero 44 paginas. |
| `npm run lint` | Fallo, codigo de salida 1: `Missing script: "lint"`. No se ejecuto un linter. |
| `npm test` | Fallo, codigo de salida 1: `Missing script: "test"`. No existe suite propia que ejecutar. |
