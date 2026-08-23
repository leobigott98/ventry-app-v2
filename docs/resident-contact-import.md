# Importación de contactos del residente

`resident_contacts` es una libreta privada del residente para reutilizar visitantes en invitaciones. No forma parte del censo `residents`, no está disponible para garitas, otros residentes ni administradores, y no se envía a terceros.

## Compatibilidad por capacidad

| Capacidad | Cuándo está disponible | Comportamiento |
| --- | --- | --- |
| Contact Picker API | Navegadores que exponen `navigator.contacts`, normalmente móviles compatibles y contexto seguro HTTPS | Solo después de pulsar **Elegir del teléfono**. Se solicitan exclusivamente `name` y `tel`; el sistema operativo muestra su propio selector. |
| Archivo vCard | Navegadores con selector de archivos | El residente elige un `.vcf`. Ventry procesa localmente únicamente `FN`/`N` y `TEL`; ignora correo, dirección, foto y demás campos. |
| Creación manual | Todos los navegadores soportados por la aplicación | Siempre visible y disponible, sin acceso a la agenda. |

La Contact Picker API no es universal, especialmente en navegadores de escritorio y algunos navegadores móviles. La interfaz detecta la capacidad en tiempo de ejecución y conserva vCard y creación manual como fallback. No se promete una importación nativa universal.

## Revisión y privacidad

Ninguna fuente guarda contactos al seleccionarlos o leer el archivo. Primero se normalizan los teléfonos, se marcan duplicados contra la libreta existente y dentro del lote, y se muestra una revisión. Solo se envían al backend los contactos que el residente deja seleccionados y confirma. Cancelar el selector o la revisión no realiza solicitudes de guardado.

Los teléfonos venezolanos locales (`0412…`) se normalizan a E.164 (`+58412…`). Los números internacionales deben incluir `+` o `00`, salvo el prefijo venezolano `58`, para evitar deduplicaciones ambiguas.
