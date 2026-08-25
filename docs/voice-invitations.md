# Invitaciones por voz

## Alcance y arquitectura

`/app/invitations/voice` graba audio real con `MediaRecorder`, lo envía como `multipart/form-data` a un endpoint Node.js autenticado, transcribe el archivo terminado y obtiene un borrador estructurado. La pantalla obliga a revisar y editar antes de crear. Transcribir, resolver una aclaración o seleccionar un contacto nunca crea una invitación.

La confirmación usa el mismo `POST /api/invitations` del formulario manual. Ese endpoint conserva el schema normal, el aislamiento de residente/comunidad, el RPC idempotente, la creación atómica de credencial QR/PIN y el evento de auditoría.

Los contratos desacoplados son:

- `TranscriptionProvider`, implementado en producción por `OpenAITranscriptionProvider`.
- `InvitationExtractionProvider`, implementado en producción por `OpenAIInvitationExtractionProvider`.
- `FakeTranscriptionProvider` y `FakeInvitationExtractionProvider`, inyectados exclusivamente en pruebas.

El cliente nunca elige modelo, proveedor ni adaptador. El cliente tampoco recibe la API key ni información que permita inferirla. El SDK se inicializa de forma lazy dentro de cada operación; importar o construir la aplicación no exige credenciales.

## Proveedor y variables

Variables server-side:

```env
OPENAI_API_KEY=
OPENAI_TRANSCRIPTION_MODEL=gpt-transcribe
OPENAI_EXTRACTION_MODEL=gpt-5.6-luna
VOICE_PROVIDER_TIMEOUT_MS=30000
```

Ninguna usa `NEXT_PUBLIC_`. Si falta la clave, el endpoint responde `503` con `VOICE_PROVIDER_NOT_CONFIGURED` y la UI muestra “Invitar hablando no está disponible por el momento” con salida al formulario manual.

La configuración de pruebas elimina `OPENAI_API_KEY` del proceso antes de cargar casos y verifica que los adaptadores sin clave no intenten red. Las pruebas automatizadas usan únicamente adaptadores falsos; no consumen cuota real.

La transcripción usa `/v1/audio/transcriptions`. La extracción usa Responses API con Structured Outputs generado directamente desde Zod y `store: false`. No se usan Files API, Assistants, Threads, Conversations ni Realtime.

## Retención y privacidad

**Retención de audio en Ventry: cero. Procesamiento temporal en memoria durante la solicitud.**

- El audio no se guarda en Supabase Storage, Vercel Blob, disco permanente, base de datos, invitación, auditoría ni logs.
- El transcript no se guarda como entidad independiente ni se adjunta a la invitación.
- Solo se persisten los campos normales de la invitación después de confirmación humana.
- La tabla de límites guarda únicamente user ID, community ID, timestamps, expiración y estado general.
- Ventry envía audio y transcript a OpenAI cuando la función está configurada. La extracción es stateless con `store: false`.

`store: false` no certifica por sí solo Zero Data Retention para la organización. Antes de producción se debe verificar la política vigente del proveedor y la configuración real del proyecto. La documentación oficial vigente indica que los controles ZDR requieren aprobación y configuración de organización/proyecto.

## Audio, límites y cancelación

- Duración máxima: 30 segundos.
- Tamaño máximo: 3 MB.
- Formatos producidos preferidos: WebM/Opus y MP4/AAC.
- El servidor valida tamaño, extensión, firma real y duración contenida para WAV, MP4/M4A, WebM, MP3, Ogg y FLAC antes de llamar al proveedor.
- Una cancelación aborta el `fetch`, invalida respuestas tardías, detiene `MediaRecorder`, detiene todos los tracks, cancela timers y libera blobs/chunks.
- No se solicita permiso al cargar. La persona debe pulsar primero “Preparar micrófono” y luego aceptar la explicación de permiso.

## Rate limit y concurrencia

La migración `202608230004_voice_transcription_limits.sql` crea un lock y contador persistentes en Postgres:

- Identidad por usuario autenticado y comunidad.
- 10 operaciones por cada ventana móvil de 10 minutos.
- Una solicitud activa por usuario/comunidad.
- Serialización mediante advisory transaction lock e índice único parcial.
- Expiración automática de locks abandonados y liberación en `finally`.
- Sin audio, transcript, nombres, PIN, QR, tokens ni contenido de invitación.

La migración incluye RLS, revocación de acceso directo, RPCs con privilegios mínimos y rollback. No fue aplicada de forma remota por esta tarea.

## Fechas y zona horaria

El servidor obtiene la zona IANA de la comunidad y aporta a la extracción el instante UTC, la fecha local de referencia, el idioma español y el contexto venezolano. `Intl.DateTimeFormat` valida la zona; no se usa la zona del navegador como autoridad. Una zona ausente o inválida devuelve `COMMUNITY_TIMEZONE_MISSING`.

El borrador admite `null` y ambigüedades. “A las dos” sin contexto produce una pregunta AM/PM; una fecha o identidad ausente produce solo la aclaración correspondiente; el fin anterior al inicio se rechaza. Los contactos se buscan localmente después de la extracción: nunca se envía la libreta completa al proveedor. Los resultados se limitan al residente autenticado y exponen solo nombre, relación y últimos cuatro dígitos cuando ayudan a distinguir duplicados.

## Activación futura

1. Crear o seleccionar un proyecto en OpenAI Platform.
2. Activar facturación de API o créditos; ChatGPT no cubre el consumo de API.
3. Crear una clave restringida al proyecto.
4. Configurar `OPENAI_API_KEY` como variable server-side en desarrollo y Vercel.
5. Configurar `OPENAI_TRANSCRIPTION_MODEL` y `OPENAI_EXTRACTION_MODEL`.
6. Aplicar la migración de rate limiting mediante el proceso humano aprobado y hacer redeploy.
7. Ejecutar una prueba controlada con audio no sensible y confirmar transcript, borrador y creación normal.
8. Revisar usage limits, alertas de gasto, latencia y tasa de aclaraciones del piloto.
9. No colocar la clave en `NEXT_PUBLIC_*`.
10. No compartir ni versionar `.env.local`.

## Costos y limitaciones (verificados el 23 de agosto de 2026)

La documentación oficial de `gpt-transcribe` publica USD 0,0045 por minuto: 30 segundos cuestan aproximadamente USD 0,00225 y 1.000 grabaciones de 30 segundos aproximadamente USD 2,25, solo por transcripción. La extracción con `gpt-5.6-luna` añade tokens de entrada y salida. Con el límite inicial, el máximo teórico es cinco minutos de audio por usuario y ventana de diez minutos.

Los precios y modelos pueden cambiar. El costo real depende de duración, tokens, reintentos y precios vigentes. También existen latencia de red, variación de formatos entre navegadores, ruido que afecta nombres propios y frases ambiguas que requieren confirmación. No se muestran ni fijan precios en la UI.

Fuentes oficiales: [GPT Transcribe](https://developers.openai.com/api/docs/models/gpt-transcribe), [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna) y [controles de datos](https://developers.openai.com/api/docs/guides/your-data#default-usage-policies-by-endpoint).
