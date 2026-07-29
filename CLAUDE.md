# Insumos-Cima — Instrucciones para Claude

Este repositorio contiene el sistema completo de **gestión de insumos médicos CIMA**: dos apps que se sincronizan en tiempo real a través del mismo proyecto Firebase.

## Las dos apps

| Archivo | Rol | Audiencia |
|---|---|---|
| `stock-insumos.html` | Panel de **control de stock** — catálogo, altas/bajas, vencimientos, entregas, visor de solicitudes | Equipo CIMA (autenticado, no anónimo) |
| `pedido-insumos.html` | Formulario de **solicitud de insumos** | Cualquier persona del staff (login anónimo) |

Ambas leen/escriben la misma base Firestore (proyecto `medtrack-cima-3e9c1`, colección raíz `insumos_cima`). Cuando se edita el catálogo en `stock-insumos.html`, se refleja al instante en `pedido-insumos.html`, y viceversa: cuando una solicitud se marca como leída/entregada en `stock-insumos.html`, ese estado aparece también en `pedido-insumos.html`.

`stock-insumos.html` además lee (solo lectura) el documento de equipos de **MedTrack** (`orgs/cima/app/data`, repo separado `github.com/Ivangn9/medtrack`) para mostrar conteos de entregas por categoría de equipo — es una dependencia de datos entre apps, no de código; funciona porque comparten el mismo proyecto Firebase.

## `telicioso.html`

App de venta de comida, sin relación con CIMA. Convive en este repo pero es un proyecto totalmente aparte — **no tocar** salvo pedido explícito para esa app puntual.

## Firebase

- Proyecto: `medtrack-cima-3e9c1` (compartido con el repo `medtrack` — no crear proyectos nuevos sin confirmación explícita del usuario)
- Cloud Function `notifySolicitud` (`functions/index.js`): dispara push (FCM) al equipo cuando llega una solicitud nueva vía `pedido-insumos.html`. El link/ícono del push apuntan a `stock-insumos.html?tab=solicitudes` **de este mismo repo**.
- `firestore.rules`: copia de referencia — el archivo real se pega manualmente en Firebase Console → Firestore → Reglas. Cubre ambas apps de este repo (y también las colecciones de MedTrack, porque es la misma base). Si se edita acá, recordar pegar el cambio en la consola.
- Deploy de Functions: workflow `.github/workflows/deploy-functions.yml`, dispara con push a `main` que toque `functions/**`, `firebase.json` o `.firebaserc`. Requiere el secret `FIREBASE_SERVICE_ACCOUNT` configurado en este repo (Settings → Secrets → Actions).

## Deploy — GitHub Pages

Cada push a `main` dispara "Deploy to GitHub Pages" (`.github/workflows/deploy.yml`), igual que en `medtrack`. Los cambios no se ven en `ivangn9.github.io/Insumos-Cima/` hasta que el workflow termina en verde.

## Historia

Este repo separó `stock-insumos.html` de `github.com/Ivangn9/medtrack` (donde vivía mezclado junto a la app MedTrack) para que Stock de Insumos quede independiente. `pedido-insumos.html` ya vivía acá desde antes. La URL de MedTrack (con los QR físicos pegados en equipos) no cambió en ningún momento de esa separación.
