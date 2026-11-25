# Agenda

Agenda diaria (PWA) para registrar rutas, empaques, viajes Z18 y faltas/permisos/vacaciones/suspensiones IGSS. Rinze Studio.

- **Frontend:** HTML + CSS + JavaScript sin dependencias (`index.html`, `css/`, `js/app.js`). Funciona sin conexión e instalable (manifest + service worker).
- **Datos:** se guardan en el navegador (localStorage). Con una clave de sincronización (Ajustes) se copian a Vercel Blob mediante `api/sync.js`, para tener laptop y celular sincronizados.
- **Sincronización:** cada registro lleva `_u` (fecha de modificación); al combinar gana el cambio más reciente. Se conservan las 5 últimas versiones en Blob.
- **PDF:** Ajustes → Exportar agenda a PDF (vista de impresión del navegador).

## Despliegue
Vercel (proyecto enlazado a este repositorio). Requiere la variable `BLOB_READ_WRITE_TOKEN` (se crea al conectar un Blob store al proyecto).
