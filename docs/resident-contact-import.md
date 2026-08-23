# Importación de contactos del residente

La pantalla combina sugerencias calculadas desde todas las invitaciones del residente con su libreta privada `resident_contacts`. Consultar el historial no crea filas persistentes. La libreta no forma parte del censo `residents`, no está disponible para garitas, otros residentes ni administradores, y no se envía a terceros.

## Compatibilidad por capacidad

| Capacidad | Cuándo está disponible | Comportamiento |
| --- | --- | --- |
| Historial automático | Todos los navegadores | Las personas invitadas aparecen sin acceder a la agenda y sin guardarlas silenciosamente. |
| Contact Picker API | Navegadores que exponen `navigator.contacts`, ofrecen `name` y `tel`, y se ejecutan en un contexto seguro HTTPS | Solo después de pulsar **Elegir del teléfono**. Se solicitan exclusivamente `name` y `tel`; el sistema operativo muestra su propio selector. |
| Creación manual | Todos los navegadores soportados por la aplicación | Siempre visible y disponible, sin acceso a la agenda. |

La Contact Picker API no es universal, especialmente en Safari/iPhone y navegadores de escritorio. Si la capacidad no existe, la interfaz no muestra un control roto: conserva el historial automático y la creación manual. El piloto no presenta archivos vCard en su experiencia principal.

Una integración universal con la agenda de iPhone y Android requeriría posteriormente una aplicación nativa o un wrapper móvil con permisos del sistema operativo. No se promete importación nativa universal en la web.

## Revisión y privacidad

El selector no guarda al elegir. Primero se normalizan los teléfonos, se marcan duplicados contra la libreta existente y dentro del lote, y se muestra una revisión. Solo se envían al backend las personas que el residente deja seleccionadas y confirma. Cancelar el selector o la revisión no realiza solicitudes de guardado.

Los teléfonos venezolanos locales (`0412…`) se normalizan a E.164 (`+58412…`). Los números internacionales deben incluir `+` o `00`, salvo el prefijo venezolano `58`, para evitar deduplicaciones ambiguas.

## Uso en invitaciones y eventos

Los residentes pueden buscar su modelo unificado de contactos directamente desde el campo de nombre en invitaciones individuales, grupos y eventos. La búsqueda se ejecuta después de una pausa breve, devuelve como máximo cinco coincidencias y considera nombre, teléfono y relación sin distinguir mayúsculas ni acentos. El servidor aplica el alcance de comunidad y residente antes de consultar historial o contactos guardados.

Seleccionar una sugerencia solo prellena el nombre y el teléfono; nunca avanza el flujo ni crea una invitación. El texto manual continúa disponible si la búsqueda no responde o no encuentra coincidencias. Los contactos nuevos se guardan únicamente después de crear correctamente la invitación o evento y solo cuando el residente activa la opción correspondiente.
