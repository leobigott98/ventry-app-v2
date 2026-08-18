# Despliegue de autenticacion SSR y RLS en staging

Esta guia aplica a `202608180001_supabase_auth_rls.sql`. No ejecutar estos pasos en produccion sin una revision humana separada, respaldo verificado y ventana de despliegue.

## Preparacion

1. Crear un respaldo o snapshot restaurable del proyecto de staging y registrar el punto exacto anterior al cambio.
2. Confirmar que staging tiene `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. La ultima variable solo se consume desde `src/lib/supabase/admin.ts` y nunca debe tener prefijo `NEXT_PUBLIC_`.
3. Verificar que cada membresia existente que ya tenga cuenta Auth use el `auth_user_id` correcto. Las filas antiguas con `auth_user_id is null` se vinculan en el proximo login solo cuando el correo de la membresia coincide con el correo del JWT verificado.
4. Identificar cuentas que abandonaron onboarding antes de crear una membresia. El nuevo flujo exige `app_metadata.can_create_community = true`; `user_metadata.role` ya no autoriza onboarding.
5. Agregar a las URL permitidas de Supabase Auth el callback de staging: `https://<host-staging>/auth/callback`.

## Validacion previa y aplicacion manual

Desde una copia limpia de esta rama:

```powershell
supabase migration list --linked
supabase db push --linked --dry-run
```

Revisar que el dry-run contenga solamente la migracion nueva. Con aprobacion humana explicita para staging:

```powershell
supabase db push --linked
```

La aplicacion no debe hacerse desde esta tarea ni contra produccion.

## Pruebas posteriores

Ejecutar el harness dentro de una conexion SQL de staging o, preferiblemente, contra un clon descartable ya migrado. Usa una transaccion y revierte todos sus fixtures:

```powershell
psql $env:STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/tests/rls_multi_tenant.sql
```

Luego validar manualmente:

1. Login de un admin, un guardia y dos residentes de la misma comunidad.
2. Un usuario de una segunda comunidad no aparece en consultas, URLs por ID ni busquedas de garita de la primera.
3. Cada residente solo ve y modifica sus invitaciones y eventos, y solo ve su historial permitido.
4. El guardia opera validaciones, entradas, salidas y asistentes de eventos, pero no modifica comunidad, unidades, residentes ni membresias.
   La validacion usa RPC estrechos que devuelven solo el ID coincidente; el guardia no puede seleccionar las tablas de credenciales ni recibe el PIN/QR crudo en la respuesta o bitacora.
5. `/invite/<shareToken>` y `/event/<shareToken>` funcionan sin login y sus RPC no exponen IDs tenant, correos, telefonos, notas, actividad ni listas de invitados.
6. Signup, onboarding, logo, logout y recuperacion de clave mediante `/auth/callback` completan el flujo.
7. Una cookie `ventry_session` fabricada o heredada se elimina y no concede acceso; solo las cookies Supabase verificadas son aceptadas.

## Sesiones y cuentas antiguas

- Todas las cookies `ventry_session` dejan de ser validas y middleware las expira. Los usuarios deben iniciar sesion nuevamente.
- Las sesiones Supabase existentes pueden continuar si sus cookies son validas; middleware las refresca con `auth.getUser()`.
- Una membresia antigua sin `auth_user_id` se reclama por correo verificado en login. Corregir manualmente duplicados o correos divergentes antes del despliegue.
- Una cuenta antigua detenida antes de onboarding y sin membresia necesita que un operador de staging establezca `app_metadata.can_create_community = true`, o debe recrearse mediante signup. No copiar `user_metadata.role` a autorizacion.
- Si un administrador asigna acceso a un correo que ya existe en Supabase Auth pero pertenece a otra membresia, la cuenta se vincula sin cambiar su contrasena ni metadata. La interfaz informa que debe conservar su clave actual; solo la membresia ya vinculada puede rotarla desde este flujo.
- Los enlaces antiguos de reset basados en tokens dentro del fragmento URL no siguen el nuevo flujo PKCE; solicitar un enlace nuevo despues del despliegue.

## Reversion en staging

La opcion preferida es restaurar el snapshot previo, porque devuelve esquema, grants y datos al mismo punto. Si se necesita una reversion logica:

1. Detener trafico o activar mantenimiento.
2. Desplegar primero la version anterior de la aplicacion; esta version nueva depende de los RPC creados por la migracion.
3. Revisar y ejecutar manualmente `supabase/rollback/202608180001_supabase_auth_rls.down.sql` en staging mediante `psql` con `ON_ERROR_STOP=1`.
4. Confirmar que las rutas publicas y el login anterior funcionan, y documentar que la reversion restaura deliberadamente el modelo inseguro sin RLS.

El script de rollback no borra datos ni el bucket, pero elimina policies/RPC, deshabilita RLS en las tablas de negocio y restaura grants permisivos al rol anon. No usarlo en produccion como sustituto de una restauracion probada.
