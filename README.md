# Agenda — Rinze Studio

Agenda diaria (PWA) para registrar rutas, empaques, viajes Z18 y faltas / permisos / vacaciones / suspensiones IGSS. Versión actual y cambios: ver `CHANGELOG.md` (y Ajustes → Versiones dentro de la app).

## Estructura
| Archivo | Contenido |
|---|---|
| `index.html` | Página principal |
| `css/app.css` | Estilos (colores crema tipo libreta) |
| `js/app.js` | Toda la lógica de la app (`VERSION` y `CHANGELOG` al inicio) |
| `js/carga-inicial.js` | Carga inicial de colaboradores y camiones (desde los Excel) |
| `api/sync.js` | Función de Vercel que sincroniza los datos en Vercel Blob |
| `sw.js`, `manifest.webmanifest`, `icons/` | App instalable y funcionamiento sin conexión |

## Datos y sincronización
- Los datos se guardan en el navegador (localStorage).
- Con una clave de sincronización (Ajustes) se copian a Vercel Blob mediante `api/sync.js`; gana el cambio más reciente por registro y se guardan las 5 últimas versiones.
- Respaldo manual: Ajustes → Descargar respaldo (.json).

## Despliegue
Proyecto de Vercel enlazado a este repositorio: cada `push` a `main` se publica solo. Requiere un Blob store conectado al proyecto (`BLOB_STORE_ID` con OIDC, o `BLOB_READ_WRITE_TOKEN`).

## Subir una actualización manualmente
1. Sube el archivo a GitHub (Add file → Upload files) respetando las carpetas.
2. En `js/app.js` sube `VERSION`, agrega la línea en `CHANGELOG` y en `CHANGELOG.md`.
3. En `sw.js` cambia el nombre de `CACHE` (por ejemplo `agenda-v13`) para que los equipos tomen la nueva versión.
