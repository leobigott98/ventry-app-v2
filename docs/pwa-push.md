# PWA y notificaciones de Ventry

La PWA usa el manifiesto de Next.js y un service worker del mismo origen. Sin conexión muestra una pantalla de Ventry con la opción de reintentar. El worker almacena solo esa pantalla y sus recursos públicos. La sesión, las rutas de la app, las invitaciones públicas y las respuestas de API usan la red.

## Configuración de un entorno de pruebas

1. Revisa la migración `202611160001_pwa_push.sql` con quien administre Supabase. Aplícala manualmente en un entorno autorizado antes de probar. El proyecto necesita conectividad HTTPS de salida a los servicios push del navegador.
2. Desde un entorno privado ejecuta `npx web-push generate-vapid-keys` y guarda el par en el gestor de secretos. Usa un par estable por entorno.
3. Crea un login PostgreSQL exclusivo para el worker y concédele el rol `ventry_push_worker` creado por la migración. Asígnale la contraseña por un canal seguro, por ejemplo con `\password ventry_push_dispatcher` en una sesión de `psql`. El worker usa funciones limitadas de la cola. Las rutas de sesión siguen usando Auth y RLS.

```sql
create role ventry_push_dispatcher login inherit;
grant ventry_push_worker to ventry_push_dispatcher;
```

| Variable | Uso |
| --- | --- |
| `VAPID_PUBLIC_KEY` | Clave pública. La API de preferencias la entrega a la sesión activa. |
| `VAPID_PRIVATE_KEY` | Clave privada. Solo se lee en el módulo de envío del servidor. |
| `VAPID_SUBJECT` | Contacto VAPID `mailto:` o URL HTTPS del operador. |
| `PUSH_DATABASE_URL` | Conexión PostgreSQL del login limitado. Usa TLS con verificación del servidor, por ejemplo `sslmode=verify-full` con la CA del proveedor si se requiere. |
| `PUSH_WORKER_SECRET` | Secreto aleatorio de al menos 32 caracteres para invocar el worker. |

Programa una tarea de servidor que haga `POST /api/push/worker` con `Authorization: Bearer <PUSH_WORKER_SECRET>`. Para pruebas de acceso, una frecuencia de 15–30 segundos permite observar los avisos y procesa reintentos. Cada ejecución reclama hasta 20 entregas. La prueba del dispositivo intenta el envío en el momento y usa la misma cola si necesita reintentarlo.

La prueba solo acepta la instalación registrada del usuario autenticado y admite un intento por minuto. Ventry distingue la aceptación por el proveedor de la aparición efectiva en el dispositivo. Con el envío sin configurar, los avisos de acceso siguen apareciendo en la bandeja una vez instalada la migración.

## Pruebas automatizadas

Ejecuta `npm run verify` para revisar lint, TypeScript, Vitest y build. En una base descartable preparada con las migraciones, ejecuta `psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/pwa_push.sql`. El script revierte todos sus datos de prueba.

## Qué verificar en cada plataforma

**Chrome en Android.** Abre Ventry mediante HTTPS e inicia sesión. En **Notificaciones → Preferencias**, pulsa **Activar notificaciones** y concede el permiso. Pulsa **Enviar prueba**, bloquea el teléfono y verifica el aviso del sistema. Abre el aviso y comprueba que vuelve al detalle autenticado. Luego deniega el permiso y genera una entrada para esa cuenta. Comprueba que el aviso de acceso aparece en la bandeja.

**PWA instalada en Android.** Desde el menú de Chrome elige **Instalar aplicación** o **Añadir a pantalla de inicio** y abre Ventry desde su icono. Revisa el estado del dispositivo en Preferencias y repite la prueba. Con la app cerrada o en segundo plano, prueba el toque en el aviso y su acción **Abrir** o **Revisar** si el navegador la muestra. Visita Ventry online una vez, corta la red, vuelve a abrirlo y verifica la pantalla **Sin conexión** y el botón **Reintentar**.

**PWA instalada en iPhone.** En iOS 16.4 o posterior, abre Ventry en Safari, usa **Compartir → Añadir a pantalla de inicio** y ábrelo desde el icono. Inicia sesión dentro de la PWA. En Preferencias, pulsa **Activar notificaciones** para que iOS pueda mostrar el permiso. Envía una prueba con la PWA en segundo plano y verifica el aviso en la pantalla bloqueada y la apertura del detalle. Si iOS no muestra las acciones adicionales, toca el cuerpo del aviso.

## Pruebas de acceso y privacidad

- En Garita, abre **Sin invitación**, selecciona un residente con cuenta activa e indica el nombre de la visita. Pulsa **Pedir confirmación en Ventry**. El residente debe encontrar el aviso y poder responder desde su cuenta, con o sin permiso push. La garita muestra la respuesta. Registrar la entrada sigue siendo una acción del guardia.
- Registra una entrada para el mismo residente y verifica una fila con el detalle correspondiente. Prueba una invitación, un invitado de evento y un acceso manual con residente asignado. Las entradas sin residente vinculado quedan en la bitácora.
- Valida un QR o PIN reconocido que esté fuera de horario, usado o revocado. Repite la validación dentro del mismo intervalo de dos minutos y verifica un solo aviso para el recurso. Los códigos desconocidos carecen de destinatario. Un rechazo explícito de garita genera el mismo tipo de aviso cuando identifica una invitación o evento.
- Desactiva un tipo de aviso e inicia un evento nuevo. Debe aparecer en la bandeja y omitirse el envío al sistema. Verifica que una cuenta vecina, un guardia y un administrador no pueden leer las suscripciones ni los avisos de otra cuenta.
- Cierra sesión y verifica que ese navegador deja de recibir avisos de la cuenta. Para rotar VAPID, cambia el par completo en el servidor. Al abrir Ventry, las instalaciones activas intentan renovar su suscripción. Si el navegador requiere interacción, usa **Reactivar notificaciones** o desactiva y vuelve a activar el dispositivo en Preferencias. Una respuesta 404 o 410 del proveedor marca esa versión de la suscripción como vencida.

## Llamadas y comportamiento del sistema

El intercomunicador todavía no genera llamadas. La futura señalización debe usar `ventry_push.notify_call(community, recipient, call, kind)` desde el flujo autorizado que persista la transición. Emite `call_incoming` o `call_missed` con el ID estable de la llamada. Tras confirmar la transacción, usa el ID devuelto para llamar a `deliverQueuedPush(eventId)` desde el servidor. La entrega entrante caduca a los 30 segundos. La transición a perdida omite los avisos entrantes todavía pendientes. El detalle abre en Ventry y servirá para enlazar con la futura pantalla de llamada.

El sistema operativo y el navegador deciden si muestran la acción, reproducen sonido o aplican el patrón de vibración solicitado. El resultado depende del canal o ajustes de notificaciones, volumen, modo silencio, Focus, No molestar y restricciones del dispositivo. Web Push no garantiza la entrega inmediata ni permite reproducir un tono elegido en segundo plano. La pantalla bloqueada muestra texto fijo sin nombres, teléfonos, placas ni secretos de acceso.

- [Guía de PWA de Next.js](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Web Push para apps de pantalla de inicio en iOS y iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
