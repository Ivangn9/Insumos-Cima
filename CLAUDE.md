# Insumos-Cima — Instrucciones para Claude

Este repositorio contiene el sistema completo de **gestión de insumos médicos CIMA**: dos apps que se sincronizan en tiempo real a través del mismo proyecto Firebase.

## Las dos apps

| Archivo | Rol | Audiencia |
|---|---|---|
| `stock-insumos.html` | Panel de **control de stock** — catálogo, altas/bajas, vencimientos, entregas, visor de solicitudes | Equipo CIMA (autenticado, no anónimo) |
| `pedido-insumos.html` | Formulario de **solicitud de insumos** | Cualquier persona del staff (login anónimo) |

Ambas leen/escriben la misma base Firestore (proyecto `medtrack-cima-3e9c1`, colección raíz `insumos_cima`). Cuando se edita el catálogo en `stock-insumos.html`, se refleja al instante en `pedido-insumos.html`, y viceversa: cuando una solicitud se marca como leída/entregada en `stock-insumos.html`, ese estado aparece también en `pedido-insumos.html`.

`stock-insumos.html` además intenta leer (solo lectura, `_loadEntregasCounts()` ~línea 7093) un documento de equipos para mostrar conteos de entregas por categoría — pero lee `users/{currentUser.uid}/app/data` (ruta LEGACY de MedTrack, un doc personal por uid), NO `orgs/cima/app/data` (la ruta actual de MedTrack, compartida por org). Corregido acá el 2026-07-29: la documentación anterior decía `orgs/cima/app/data`, estaba mal. Como el uid de un usuario de Insumos normalmente no tiene datos en esa ruta legacy, es probable que `_medtrackEqs` quede vacío en la práctica — parece un bug preexistente, no relacionado con el fix de seguridad de MedTrack del mismo día. No se tocó, queda para revisar si se pide puntualmente.

## `telicioso.html`

App de venta de comida, sin relación con CIMA. Convive en este repo pero es un proyecto totalmente aparte — **no tocar** salvo pedido explícito para esa app puntual.

## Firebase

- Proyecto: `medtrack-cima-3e9c1` (compartido con el repo `medtrack` — no crear proyectos nuevos sin confirmación explícita del usuario)
- Cloud Function `notifySolicitud` (`functions/index.js`): dispara push (FCM) al equipo cuando llega una solicitud nueva vía `pedido-insumos.html`. El link/ícono del push apuntan a `stock-insumos.html?tab=solicitudes` **de este mismo repo**.
- `firestore.rules`: copia de referencia — el archivo real se pega manualmente en Firebase Console → Firestore → Reglas. Cubre ambas apps de este repo (y también las colecciones de MedTrack, porque es la misma base). Si se edita acá, recordar pegar el cambio en la consola.
- Deploy de Functions: workflow `.github/workflows/deploy-functions.yml`, dispara con push a `main` que toque `functions/**`, `firebase.json` o `.firebaserc`. Requiere el secret `FIREBASE_SERVICE_ACCOUNT` configurado en este repo (Settings → Secrets → Actions).

## Versiones — `stock-insumos.html`

- `const APP_VERSION` (en `stock-insumos.html`) debe coincidir SIEMPRE con la misma constante en `firebase-messaging-sw.js` — el propio service worker lo indica ("Auto-update: keep this in sync"). Si no coinciden, el aviso de nueva versión no se detecta correctamente.
- Formato `MAJOR.MINOR` (sin PATCH). Bump manual (no hay script tipo `tools/bump.js` acá todavía): patch/fix menores no requieren bump; una feature nueva sube MINOR (ej. `6.0`→`6.1`); un cambio estructural grande sube MAJOR y resetea MINOR a 0.
- No hay changelog embebido (a diferencia de MedTrack) — no hace falta tocar nada más allá de las dos constantes.

## Features — Comparador de presupuestos de proveedores

Modal `#comparadorModal`, prefijo de funciones `_cp*` (cerca de `_pi*` en el código, cerca de la línea 4025). Permite subir hasta 10 Excel (uno por proveedor, columnas variables por archivo) y compara precio por insumo, emparejando entre archivos por similitud de nombre (reutiliza `_impNorm`/`_impSim`, umbral ajustable, default 95%). **No persiste nada en Firestore** — es una herramienta de trabajo puntual, el estado se pierde al cerrar el modal. No confundir con `_pi*` (Importar lista de precios), que sí actualiza el catálogo real.

## Deploy — GitHub Pages

Cada push a `main` dispara "Deploy to GitHub Pages" (`.github/workflows/deploy.yml`), igual que en `medtrack`. Los cambios no se ven en `ivangn9.github.io/Insumos-Cima/` hasta que el workflow termina en verde.

## Historia

Este repo separó `stock-insumos.html` de `github.com/Ivangn9/medtrack` (donde vivía mezclado junto a la app MedTrack) para que Stock de Insumos quede independiente. `pedido-insumos.html` ya vivía acá desde antes. La URL de MedTrack (con los QR físicos pegados en equipos) no cambió en ningún momento de esa separación.
