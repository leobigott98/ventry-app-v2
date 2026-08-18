# Mapa de migracion desde la referencia de Figma

Fuente visual inspeccionada: `Ventry Access-Control App.zip`. El ZIP es un prototipo Vite: `src/main.tsx` monta un unico `src/app/App.tsx`, y la navegacion/rol viven en estado local. Sus personas, invitaciones, accesos y configuraciones son datos hardcodeados. Se usa como referencia de presentacion, no como fuente de arquitectura, permisos ni comportamiento.

## Comparacion explicita: repositorio actual vs. ZIP

| Dimension | Repositorio actual | ZIP de Figma | Regla de migracion |
| --- | --- | --- | --- |
| Runtime | Next.js App Router con paginas, layouts y Route Handlers | Vite con `src/main.tsx`, `vite.config.ts` y un `App.tsx` monolitico | No copiar el runtime ni crear una app paralela. |
| Navegacion | Rutas reales y layout protegido bajo `/app` | `useState` cambia identificadores de pantalla | Conservar URLs, redirects y App Router. |
| Identidad y roles | Supabase Auth, membresias y permisos `admin`/`guard`/`resident` | Selector de rol local sin autenticacion | No portar el selector; conservar controles de pagina, API y dominio. |
| Datos | Consultas y mutaciones Supabase por comunidad/residente | Arreglos y textos fijos | El rediseño debe consumir los datos reales existentes. |
| Invitaciones | PIN/QR, ventanas, revocacion, compartir, historial y ruta publica | Interacciones visuales con resultados predefinidos | Rediseñar componentes existentes sin reemplazar su logica. |
| Eventos | Event Mode completo con invitados y control en garita | No aparece | Preservarlo y mantenerlo en navegacion/rutas. |
| Garita | Camara `@zxing/browser`, PIN/QR, busqueda, entrada/salida y registros manuales | Estados locales que simulan exito/error | Mantener APIs, trazabilidad y manejo de errores reales. |
| Administracion | Rutas separadas para panel, residentes, unidades, bitacora y ajustes | Secciones internas de una sola pantalla | Aplicar lenguaje visual por ruta; no fusionar dominios. |
| Rutas fuera del prototipo | Marketing, legal, auth, reset, onboarding, invitacion publica y evento publico | No aparecen | Conservarlas aunque no reciban rediseño inmediato. |

## Pantallas del ZIP y destino

| Pantalla/seccion del ZIP | Ruta(s) existente(s) | Componentes/logica que deben conservarse y recibir solo rediseño | Cobertura actual / brecha |
| --- | --- | --- | --- |
| `resident-home` — inicio del residente | `/app/dashboard` | `src/app/(app)/app/dashboard/page.tsx`, `src/components/layout/app-shell.tsx`, consultas de `src/lib/domain/community.ts`, `src/lib/domain/invitations.ts` y `src/lib/domain/access-log.ts` | Implementado con datos y acciones reales. Adaptar jerarquia visual, tarjetas y accesos rapidos; no hardcodear saludo, contactos ni estadisticas. |
| `create-invitation` — nueva invitacion por pasos | `/app/invitations/new` | `src/components/invitations/invitation-form.tsx`, `src/app/api/invitations/route.ts`, `createInvitation` en `src/lib/domain/mutations.ts`, esquemas en `src/lib/schemas/invitations.ts` | Implementado. El formulario puede adoptar el flujo visual por pasos, conservando validacion, alcance por residente, tipos y ventanas reales. |
| `voice-invitation` — invitar hablando | Sin ruta equivalente | Si se aprueba, debe terminar en el mismo `POST /api/invitations` y reutilizar el esquema/formulario de invitaciones | Ausente. El ZIP simula grabacion, procesamiento y transcripcion; requiere proveedor, permisos, privacidad, errores y confirmacion real. |
| `contacts` — contactos frecuentes | Sin ruta equivalente | Ninguno hoy; no sustituir residentes ni inventar contactos en produccion | Ausente como dominio. Definir favoritos/contactos por residente, consentimiento y origen antes de crear UI. |
| `incoming-call` — llamada entrante a residente | Sin ruta equivalente | Ninguno hoy | Ausente. El ZIP solo cambia estado local. Requiere decision de telefonia/WebRTC, notificaciones, identidad de garita y auditoria. |
| `invitation-detail` — lista/detalle con QR/PIN | `/app/invitations`, `/app/invitations/[invitationId]`, `/invite/[shareToken]` | `credential-card.tsx`, `invitation-window-form.tsx`, `revoke-invitation-button.tsx`, `share-invitation-actions.tsx`, `invitation-status-badge.tsx`, dominio `src/lib/domain/invitations.ts` | Implementado y mas completo que el ZIP. Conservar QR real, estados efectivos, permisos, compartir, revocacion e historial. |
| `guard-workspace` — validar, personas dentro y no anunciados | `/app/guards` | `src/components/guards/guard-workspace.tsx`, todos los handlers `src/app/api/guards/*`, `src/lib/domain/guards.ts`, `src/lib/domain/event-access.ts`, mutaciones de entrada/salida | Implementado. Puede adoptar tabs, densidad y jerarquia del tablet del ZIP; no reemplazar escaneo/API por estados simulados. Mantener tambien vehiculos y Event Mode aunque el ZIP no los muestre completos. |
| `call-resident` — buscar y llamar | Sin ruta equivalente | La busqueda/seleccion de residentes de garita puede reutilizarse visualmente, pero no existe logica de llamada que preservar | Parcial solo en seleccion de residente para registros manuales; llamada ausente. No mostrar botones de llamada sin integracion real. |
| `admin-dashboard` / `dashboard` | `/app/dashboard` | `src/app/(app)/app/dashboard/page.tsx` y consultas reales de resumen/actividad | Implementado. Mantener variacion por rol y datos reales. |
| `admin-dashboard` / `residents` | `/app/residents`, `/app/residents/new`, `/app/residents/[residentId]/edit`, `/app/residents/[residentId]/access`, `/app/units` y subrutas | Formularios `resident-form.tsx`, `resident-access-form.tsx`, `unit-form.tsx`; APIs de residentes/unidades; `src/lib/domain/access.ts` y `mutations.ts` | Implementado sin borrado de residentes/unidades. No portar los botones de borrar del ZIP hasta que exista comportamiento y politica reales. |
| `admin-dashboard` / `logs` | `/app/access-log`, `/app/access-log/[eventId]` | `src/components/access-log/access-log-filters.tsx`, `access-event-card.tsx`, `src/lib/domain/access-log.ts` | Implementado con filtros y detalle. Conservar alcance `admin`/`guard` y trazabilidad. |
| `admin-dashboard` / `config` | `/app/settings` | `community-profile-form.tsx`, `logo-upload-field.tsx`, formularios/acciones de acceso de equipo, APIs de comunidad y miembros | Parcial respecto al ZIP: perfil y equipo son reales; toggles de foto, push, alertas y resumen diario del prototipo no existen. No crear controles decorativos sin persistencia. |

## Funcionalidades del repositorio que el ZIP no cubre

Estas rutas y dominios son obligatorios durante cualquier rediseño posterior:

- Event Mode: `/app/events`, `/app/events/new`, `/app/events/[eventId]`, `/event/[shareToken]` y su integracion en garita/bitacora.
- Autenticacion y recuperacion: `/login`, `/signup`, `/forgot-password`, `/reset-password` y `src/app/api/auth/*`.
- Onboarding de comunidad: `/app/onboarding` y `src/app/api/community/onboarding/route.ts`.
- Rutas publicas y legales: `/invite/[shareToken]`, `/event/[shareToken]`, `/`, `/legal`, `/privacy` y `/terms`.
- Gestion completa existente de residentes, accesos de residentes, unidades, equipo y bitacora detallada.

## Limites para una futura implementacion visual

- No copiar `vite.config.ts`, `src/main.tsx`, el `App.tsx` del ZIP, marcos de telefono/tablet ni el selector de rol del prototipo.
- No importar los arreglos de ejemplo ni sus resultados de exito/error; son demostraciones visuales.
- Reutilizar los Route Handlers, esquemas Zod y funciones de dominio existentes. Los cambios visuales deben quedar principalmente en paginas/componentes.
- Si una accion del ZIP no tiene backend real (voz, contactos, llamadas o toggles de notificacion), mantenerla fuera de rutas de produccion hasta que haya una decision de producto y una implementacion completa.

