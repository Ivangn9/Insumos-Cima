const functions = require("firebase-functions");
const admin     = require("firebase-admin");
admin.initializeApp();

const ADMIN_EMAIL = "ivangarcian@gmail.com";

// Crea o resetea la contraseña de acceso de un usuario de Stock de Insumos.
// Solo lo puede llamar el admin — el SDK cliente de Firebase Auth únicamente
// puede cambiar la contraseña de LA SESIÓN YA LOGUEADA (self-service), nunca
// la de otra cuenta; para que el admin "genere" acceso a otra persona hace
// falta el SDK de Admin, que solo puede correr acá (nunca en el navegador).
// No toca insumos_users/{email} (la lista de autorización) — eso lo sigue
// manejando el cliente directo contra Firestore, como siempre.
exports.adminSetPassword = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.email !== ADMIN_EMAIL) {
    throw new functions.https.HttpsError("permission-denied", "Solo el administrador puede crear o resetear contraseñas.");
  }
  const email    = String((data && data.email) || "").trim().toLowerCase();
  const password = String((data && data.password) || "");
  if (!email || !email.includes("@")) {
    throw new functions.https.HttpsError("invalid-argument", "Email inválido.");
  }
  if (password.length < 6) {
    throw new functions.https.HttpsError("invalid-argument", "La contraseña debe tener al menos 6 caracteres.");
  }
  try {
    const existing = await admin.auth().getUserByEmail(email).catch(() => null);
    if (existing) {
      await admin.auth().updateUser(existing.uid, { password });
      return { ok: true, created: false };
    }
    await admin.auth().createUser({ email, password, emailVerified: true });
    return { ok: true, created: true };
  } catch (e) {
    throw new functions.https.HttpsError("internal", e.message || String(e));
  }
});

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
