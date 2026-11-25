# Registro de versiones — Agenda

La versión visible en la app está en `js/app.js` (`VERSION` y `CHANGELOG`). Cada actualización sube la versión.

## V.9 — 2026-11-25
- Traslados Z18 siempre en el orden GMC, AXEL, GRANDE (en el día, la semana y el PDF).

## V.8 — 2026-11-25
- Al programar una ruta, el camión se elige de una lista en columnas: camión y matrícula, chofer asignado y parrillas, con buscador. Marca los camiones ya usados en otra ruta del día.
- Al elegir un camión con chofer fijo, se asigna ese chofer.
- La ventana de la ruta conserva la posición al marcar ayudantes.

## V.7 — 2026-11-25
- Plantillas de mensajes de WhatsApp en Ajustes, una por tipo (permiso, vacaciones autorizadas, solicitud de vacaciones, falta, IGSS), con variables ({nombre}, {tarjeta}, {puesto}, {fechas}, {motivo}…), vista previa y restaurar predeterminada. Se sincronizan entre equipos.

## V.6 — 2026-11-25
- GRANDE (Z18) es el 205BDM Poison de Giovanni; se reasignan los viajes ya registrados.
- Camiones: buscador (matrícula, nombre, chofer), filtros (En agenda, Fuera de agenda, Z18, Chofer varios) y casilla “En agenda”; solo los marcados aparecen al asignar rutas y apoyo.
- Colaboradores: buscador (nombre, tarjeta, puesto) y control de duplicados: no permite repetir tarjeta y avisa si el nombre ya existe.

## V.5 — 2026-11-25
- Carga inicial desde Excel (`js/carga-inicial.js`): 86 colaboradores con tarjeta y puesto principal; 45 camiones con matrícula, capacidad en parrillas y chofer (o “Varios”).
- Los colaboradores y camiones de ejemplo se reemplazan por los del Excel y se actualizan sus referencias en días y ausencias.
- Campo “Puesto” para todos los roles y “Nota” en camiones.

## V.4 — 2026-11-25
- Aviso por WhatsApp (opción A): al autorizar un permiso o confirmar vacaciones se abre el mensaje listo para compartir a los chats; también desde cualquier ausencia. Queda registrado como “enviado”.
- Número de tarjeta del colaborador en Parámetros; aparece en ausencias y en el mensaje.
- Rol “Otro” con puesto (empacadores, verificadoras…) y filtro “Otros”. Solo choferes/ayudantes aparecen para rutas.

## V.3 — 2026-11-25
- Sincronización: usa las credenciales OIDC de Vercel con `BLOB_STORE_ID` (ya no exige `BLOB_READ_WRITE_TOKEN`).

## V.2 — 2026-11-25
- Logo oficial de Rinze Studio (`icons/rinze-studio.svg`) en el menú, encabezado del celular y Ajustes.
- Versión visible en el encabezado del celular y tabla "Versiones" en Ajustes.

## V.1 — 2026-11-25
- Primera versión: día tipo libreta, rutas, empaques, Z18, ausencias, semana, calendario, consultas, parámetros, PDF, respaldo y sincronización.
