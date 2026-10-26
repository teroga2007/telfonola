# Surco

## GitHub y Netlify

Repositorio: https://github.com/teroga2007/hitster-2.0

1. En Netlify, selecciona **Add new project → Import an existing project → GitHub**. Autoriza el acceso al repositorio `teroga2007/hitster-2.0`.
2. Selecciona la rama `main`, directorio base raíz, comando `npm run build` y publicación `dist`. `netlify.toml` ya declara esos valores y Node 24.
3. Antes de desplegar, añade `VITE_SPOTIFY_CLIENT_ID` en las variables de entorno del proyecto, con alcance **Builds** y valor del Client ID de Spotify. Es un identificador público que Vite incluye en el navegador. No añadas un client secret ni tokens.
4. Despliega y copia la URL de producción HTTPS que devuelve Netlify (por ejemplo `https://nombre-asignado.netlify.app`). No uses la URL temporal de un Deploy Preview para autorizar Spotify.
5. En el dashboard de Spotify, registra exactamente esa URL con barra final como Redirect URI: `https://nombre-asignado.netlify.app/`. Guarda y añade tu cuenta a los usuarios permitidos si la app está en modo desarrollo.
6. Abre esa misma URL en Chrome de Android. Si cambias la variable de entorno, ejecuta un nuevo despliegue para incorporarla al build.

Los futuros pushes a `main` activan el despliegue continuo. El fallback SPA conserva las URLs de entrada y la consulta OAuth. No se requieren URLs localhost en producción: el retorno de Spotify se calcula desde `location.origin`.

El service worker no intercepta peticiones ni guarda recursos o respuestas: no hay una copia offline que pueda ocultar un despliegue nuevo. Se comprueba su actualización al cargar la app, se evita su caché HTTP y las versiones nuevas se activan sin esperar al cierre de pestañas. Una sesión abierta conserva el código cargado hasta recargar; después de un despliegue vuelve a cargar la app fuera de un escaneo/reproducción pendiente. Para una limpieza excepcional: Chrome → configuración del sitio → borrar datos (también elimina la autorización local).

Si Git pide autenticación al subir, usa el inicio de sesión de Git Credential Manager en el navegador. También puedes iniciar sesión con GitHub CLI mediante `gh auth login` si la instalas. GitHub no acepta la contraseña de la cuenta para Git HTTPS; no pegues tokens en el remoto, archivos o chat. Después ejecuta `git push -u origin main`. No se usa force push.

Guías oficiales: [importar un repositorio](https://docs.netlify.com/manage/projects/add-new-project/) y [variables de entorno](https://docs.netlify.com/build/environment-variables/get-started/).

App local React + TypeScript + Vite. El repositorio estaba vacío.

## Qué permite Spotify

La Web API oficial ofrece `PUT /v1/me/player/play`, con OAuth y el permiso `user-modify-playback-state`. Controla el dispositivo activo sin navegar a Spotify. Necesita Premium y un dispositivo disponible; no arranca una aplicación Spotify cerrada ni garantiza que el Samsung esté disponible en Spotify Connect. Abrir un enlace web no reproduce de forma fiable sin cambiar de aplicación. Pantalla completa y PWA no cambian esto.

La prueba mínima está en Inicio → «Prueba mínima de reproducción», después de conectar Spotify: pega un enlace y pulsa «PROBAR SIN CÁMARA». Ejecuta únicamente esa orden oficial. Un 204 confirma aceptación de la solicitud, no audio audible. No se ha podido realizar una prueba real sin Client ID, autorización y teléfono. No hay fallback a enlaces, embeds ni cambios de foco.

Referencias oficiales:
- https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback
- https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
- https://developer.spotify.com/documentation/web-api/concepts/quota-modes
- https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide

En modo desarrollo Spotify aplica Premium al propietario y límites de usuarios autorizados (actualmente hasta cinco). Registra la cuenta de prueba en el dashboard. La disponibilidad de crear aplicaciones y el acceso dependen de Spotify.

## Preparación

1. `npm install`
2. Copia `.env.example` a `.env.local` y completa `VITE_SPOTIFY_CLIENT_ID` con el Client ID público de tu aplicación Spotify. Nunca añadas un client secret.
3. Registra en Spotify la URL de retorno exacta, por ejemplo `https://tu-dominio.example/`, incluyendo la barra final.
4. `npm run dev` para desarrollo o `npm run build` para generar `dist`. Sirve `dist` desde un hosting estático HTTPS con certificado válido. No basta una IP LAN mediante HTTP para probar cámara desde el móvil. Si usas un túnel HTTPS hacia Vite, autoriza explícitamente su hostname en la configuración de Vite y registra esa URL de retorno.
5. `npm test` ejecuta validación, QR reales normales/invertidos, respuestas de reproducción y diez aperturas consecutivas de cámara simulada. No certifica hardware real.

## Prueba en Samsung

1. Abre Spotify con Premium y reproduce cualquier audio en este teléfono. Regresa a Chrome o Samsung Internet.
2. Abre la app por HTTPS y pulsa CONECTAR SPOTIFY. Esta autorización inicial sí sale temporalmente de la app; las cartas posteriores no navegan. No se crea una cuenta propia.
3. Ejecuta primero la prueba mínima. Verifica a oído que cambia la canción y que la web sigue visible. Si falla, revisa el mensaje: sesión, Premium/permisos o dispositivo activo. No continúes dando por validada la reproducción.
4. Pulsa EMPEZAR y concede cámara. Escanea una tarjeta normal y otra blanca sobre negro. La cámara debe apagarse tras la lectura.
5. Repite SIGUIENTE CARTA al menos diez veces, incluyendo la misma tarjeta varias veces. Una sola petición PUT por lectura en las herramientas de red. Una tarjeta inválida debe ofrecer volver a escanear sin enviar nada a Spotify.
6. Deniega cámara y recupera el permiso desde la configuración del sitio. Prueba cancelar escaneo, desconexión de red y sesión Spotify caducada. Los reintentos de red son manuales para evitar órdenes duplicadas.
7. Sal voluntariamente de pantalla completa y vuelve con PANTALLA COMPLETA: debe conservar la sesión. El navegador puede salir de pantalla completa al pedir permiso. Wake Lock es un intento y puede ser denegado por ahorro de energía o al ocultar la app.
8. En Chrome usa «Añadir a pantalla de inicio» / «Instalar aplicación». En Samsung Internet usa su opción equivalente si está disponible. Manifest e iconos incluidos; no se genera APK. Requiere conexión: no hay modo offline ni caché de Spotify.
9. Activa movimiento reducido en el teléfono: el vinilo deja de girar.

## Privacidad y límites

No se solicitan metadatos de canciones ni se muestran o registran título, artista, portada o año. El identificador sólo vive en memoria para reproducir/reintentar. OAuth usa PKCE con estado anti-CSRF; el token se conserva en sessionStorage de esta pestaña hasta su caducidad. Al caducar se vuelve a conectar; no se guardan refresh tokens. No hay analítica. Las fuentes usan Google Fonts, con alternativa local del sistema.

El vinilo es decorativo: no se consulta el estado de Spotify. «Reproducción solicitada» nunca significa reproducción confirmada. El usuario puede consultar Spotify al salir voluntariamente. El navegador/Samsung puede suspender cámara, red o audio por políticas de energía; requiere la comprobación real indicada arriba.
