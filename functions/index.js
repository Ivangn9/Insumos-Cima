const functions = require("firebase-functions");
const admin     = require("firebase-admin");
admin.initializeApp();

exports.notifySolicitud = functions.firestore
  .document("insumos_cima/solicitudes_log/items/{itemId}")
  .onCreate(async (snap, context) => {
    const sol = snap.data();
    const prioEmoji = { "Muy urgente": "🚨", "Urgente": "⚠️", "Normal": "📬" }[sol.prioridad] || "📬";

    const tokensDoc = await admin.firestore()
      .collection("insumos_cima").doc("push_tokens").get();
    if (!tokensDoc.exists) return null;

    // Deduplicar tokens: el mismo dispositivo puede estar registrado bajo varios UIDs
    const tokens = [...new Set(
      Object.values(tokensDoc.data())
        .map(v => v.token)
        .filter(Boolean)
    )];
    if (!tokens.length) return null;

    const itemCount = (sol.items || []).length;
    const message = {
      tokens,
      notification: {
        title: `${prioEmoji} Pedido ${sol.prioridad || "Normal"} · ${sol.sector || ""}`,
        body:  `${sol.solicitante || "—"} · ${itemCount} insumo${itemCount !== 1 ? "s" : ""}`,
      },
      webpush: {
        notification: {
          icon:   "https://ivangn9.github.io/Insumos-Cima/Iconogestioninsumos.png",
          badge:  "https://ivangn9.github.io/Insumos-Cima/Iconogestioninsumos.png",
          vibrate: [200, 100, 200],
          requireInteraction: false,
        },
        fcmOptions: {
          link: "https://ivangn9.github.io/Insumos-Cima/stock-insumos.html?tab=solicitudes",
        },
      },
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`FCM: ${response.successCount}/${tokens.length} enviadas`);

      // Limpiar tokens inválidos
      if (response.failureCount > 0) {
        const data    = tokensDoc.data();
        const updates = {};
        response.responses.forEach((resp, i) => {
          if (!resp.success) {
            const bad = tokens[i];
            Object.entries(data).forEach(([uid, val]) => {
              if (val.token === bad) updates[uid] = admin.firestore.FieldValue.delete();
            });
          }
        });
        if (Object.keys(updates).length) {
          await admin.firestore()
            .collection("insumos_cima").doc("push_tokens").update(updates);
        }
      }
    } catch (e) {
      console.error("FCM error:", e);
    }
    return null;
  });
