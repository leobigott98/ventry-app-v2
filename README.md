# Ventry Foundations

Base inicial para una plataforma moderna de control de acceso residencial, pensada como sistema operativo de porteria y no como software administrativo generico.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui style primitives
- Supabase foundation
- React Hook Form
- Zod

## Estructura recomendada

```text
src/
  app/
    (marketing)/
      page.tsx
    (auth)/
      login/page.tsx
      signup/page.tsx
      forgot-password/page.tsx
    (app)/
      app/
        layout.tsx
        page.tsx
        dashboard/page.tsx
        invitations/page.tsx
        access-log/page.tsx
        guards/page.tsx
        residents/page.tsx
        units/page.tsx
        settings/page.tsx
    api/
      auth/
        login/route.ts
        signup/route.ts
        forgot-password/route.ts
        logout/route.ts
    globals.css
    layout.tsx
  components/
    forms/
    layout/
    ui/
  lib/
    auth/
    navigation.tsx
    schemas/
    supabase/
    utils.ts
middleware.ts
```

## Lo que incluye Sprint 0

- Landing page enfocada en acceso residencial y porteria
- Login, registro y recuperacion de contrasena
- Layout protegido para `/app`
- Navegacion mobile-first con barra inferior y sidebar en desktop
- Fundaciones visuales reutilizables
- Rutas base para dashboard, invitaciones, bitacora, guardias, residentes, unidades y ajustes
- Preparacion para conectar autenticacion y datos reales con Supabase

## Lo que agrega Sprint 1

- Onboarding de comunidad en `/app/onboarding`
- Persistencia en Supabase para comunidad, unidades, residentes y membresias
- Perfil basico de comunidad editable en `Ajustes`
- Gestion de unidades con alta y edicion
- Listado de residentes con alta y edicion
- Fundacion de roles para administradores y guardias
- Dashboard conectado a datos reales de la comunidad

## Lo que agrega Sprint 2

- Listado de invitaciones activas e historial
- Flujo rapido para crear invitaciones desde residentes activos
- Pagina de detalle de invitacion con QR o PIN
- Accion para revocar invitaciones
- Historial de eventos por invitacion
- Compartir por WhatsApp con enlace publico
- Ruta publica `/invite/[shareToken]` para mostrar el acceso al visitante

## Lo que agrega Sprint 3

- Pantalla operativa de guardia en `/app/guards`
- Validacion manual de PIN y base lista para QR
- Registro de visitantes no anunciados
- Registro manual de vehiculos
- Acciones de entrada y salida desde garita
- Busqueda rapida de invitaciones recientes
- Bitacora conectada a `access_events` y `visitor_entries`
- Logout visible en desktop y movil

## Lo que agrega Sprint 4

- Autenticacion real con Supabase para login, signup inicial y recuperacion de contrasena
- Sesion de app alineada con el rol real del usuario
- Restricciones por rol en navegacion, paginas y APIs
- Provision de accesos del equipo desde `Ajustes`
- Habilitacion de acceso para residentes desde `Residentes`
- Scope de invitaciones para que cada residente solo vea y gestione las suyas
- Ruta `/reset-password` para cerrar el flujo de recuperacion

## Modelo base de dominio

- `communities`: perfil y reglas basicas de operacion
- `community_memberships`: roles base de admin, guardia y residente
- `units`: unidades operativas del conjunto
- `residents`: censo simple ligado a unidades
- `invitations`: invitaciones de acceso ligadas a residente y unidad
- `access_credentials`: credencial QR o PIN por invitacion
- `invitation_events`: trazabilidad de creacion, envio y revocacion
- `visitor_entries`: entradas y salidas reales registradas en garita
- `access_events`: eventos operativos para auditoria y bitacora
- `community_memberships.resident_id`: vinculo entre login de residente y ficha operativa
- `community_memberships.auth_user_id`: referencia al usuario real en Supabase Auth

La migracion inicial esta en `supabase/migrations/202603280001_sprint1_foundation.sql`.
La migracion de garita esta en `supabase/migrations/202603280002_guard_workflow.sql`.
La migracion de auth/accesos esta en `supabase/migrations/202603280003_auth_access_foundation.sql`.

## Continuidad recomendada para Sprint 5

1. Reemplazar contrasenas temporales por invitaciones de activacion y cambio inicial de clave.
2. Conectar escaneo QR con camara y fallback offline.
3. Afinar permisos por accion, no solo por modulo.
4. Extender la bitacora con filtros por placa, unidad, fecha y estado.
5. Resolver sincronizacion y tolerancia offline para validacion y registros de garita.

## Variables de entorno

Duplica `.env.example` a `.env.local` y agrega:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Para Sprint 1, el server-side CRUD funciona mejor con `SUPABASE_SERVICE_ROLE_KEY` disponible.
