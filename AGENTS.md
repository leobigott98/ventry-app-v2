# Reglas del repositorio

- Conserva Next.js App Router, React, TypeScript y Tailwind; no introduzcas una app Vite paralela ni un `App.tsx` monolitico.
- Preserva el dominio Supabase existente: comunidades, membresias, roles, unidades, residentes, invitaciones, eventos, garita y bitacora.
- Mantén la separacion y los permisos de `admin`, `guard` y `resident` tanto en rutas/paginas como en APIs y consultas. La experiencia de residentes debe seguir en espanol y ser mobile-first.
- En rutas de produccion no agregues exitos simulados, datos hardcodeados ni botones sin accion. Un prototipo visual solo puede aportar presentacion a flujos reales existentes.
- Nunca expongas secretos. `SUPABASE_SERVICE_ROLE_KEY` debe quedar en un modulo admin `server-only`, nunca en clientes genericos ni componentes cliente y nunca con prefijo `NEXT_PUBLIC_`; no amplíes su uso actual sin una correccion de arquitectura revisada.
- No apliques migraciones de Supabase ni despliegues a produccion automaticamente. Esas acciones requieren una decision humana explicita.
- Antes de declarar una tarea terminada, ejecuta lint, typecheck, las pruebas disponibles y el build; si un script no existe, informalo como brecha en vez de omitirlo.
- Aunque no aparezcan en una referencia visual, conserva Event Mode, rutas publicas, onboarding, autenticacion, residentes, unidades y bitacora de accesos.
