/**
 * GOOGLE APPS SCRIPT (GAS) - STREAMHUB / HOGARPRO
 * EXCLUSIVO NETFLIX - EXTRACTOR AUTOMÁTICO DE 5 ACCIONES
 * 
 * 1. Codigo de inicio de sesion (4 dígitos numéricos para TV / pantalla)
 * 2. Codigo de verificacion (dura 15 minutos - OTP numérico)
 * 3. Solicitar actualizar hogar netflix (link oficial directo)
 * 4. Codigo de acceso temporal (link oficial de viaje / fuera de casa)
 * 5. Reestablecer contraseña (link oficial directo para cambiar clave)
 * 
 * Instrucciones:
 * 1. Abre https://script.google.com/
 * 2. Pega este código.
 * 3. Configura el Activador (Trigger) para ejecutarse cada 1 minuto (is:unread)
 *    o usa doGet para consultas bajo demanda desde el panel web.
 */

const CONFIG = {
  BASE_URL: "https://hogarpro-xrhd.vercel.app",
  WEBHOOK_URL: "https://hogarpro-xrhd.vercel.app/api/webhooks/incoming-code",
  WEBHOOK_SECRET: (typeof PropertiesService !== "undefined" && PropertiesService.getScriptProperties().getProperty("API_SECRET")) || "token_ultra_secreto_para_proteger_endpoint_de_codigos_2026",
  SEARCH_QUERY: "is:unread (from:account.netflix.com OR from:netflix.com OR from:mailer.netflix.com)",
  MAX_THREADS: 10
};

/**
 * Función que busca correos bajo demanda vía HTTP GET
 */
function doGet(e) {
  const email = (e && e.parameter && e.parameter.email) ? e.parameter.email.trim().toLowerCase() : "";
  const rawActionType = (e && e.parameter && e.parameter.actionType) ? e.parameter.actionType.trim().toLowerCase() : "login_code";

  if (!email) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "email requerido" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const result = buscarCodigoNetflix(email, rawActionType);
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  return doGet(e);
}

/**
 * Normaliza cualquier alias a las 5 opciones de Netflix
 */
function normalizarAccion(action) {
  if (!action) return "login_code";
  const a = action.toLowerCase().trim();
  if (a === "actualizar" || a === "actualizar_hogar" || a === "hogar") return "actualizar_hogar";
  if (a === "temporal" || a === "acceso_temporal" || a === "viaje") return "acceso_temporal";
  if (a === "login_confirm" || a === "verification_code" || a === "verificacion") return "verification_code";
  if (a === "reset_password" || a === "clave" || a === "password" || a === "restablecer") return "reset_password";
  if (a === "login_code" || a === "login" || a === "inicio") return "login_code";
  return a;
}

/**
 * Función con Activador Automático para correos no leídos
 */
function processIncomingStreamingEmails() {
  const threads = GmailApp.search(CONFIG.SEARCH_QUERY, 0, CONFIG.MAX_THREADS);

  for (let i = 0; i < threads.length; i++) {
    const messages = threads[i].getMessages();

    for (let j = 0; j < messages.length; j++) {
      const message = messages[j];
      if (message.isUnread()) {
        const subject = message.getSubject() || "";
        const body = message.getPlainBody() || "";
        const htmlBody = message.getBody() || "";
        const toEmail = extraerDestinatarioExacto(message.getTo() || "", body, htmlBody);
        const actionType = clasificarMensajeNetflix(subject, body, htmlBody);
        const extracted = extraerPorAccionNetflix(subject, body, htmlBody, actionType);

        if (extracted && toEmail) {
          Logger.log(`[NETFLIX AUTOMÁTICO] ${actionType}: ${extracted} para ${toEmail}`);

          const success = sendCodeToWebhook({
            account_email: toEmail,
            extracted_code: extracted,
            action_type: actionType,
            raw_subject: subject,
            raw_body: (body || htmlBody).substring(0, 4000)
          });

          if (success) {
            message.markRead();
          }
        }
      }
    }
  }
}

/**
 * Búsqueda bajo demanda para una cuenta específica y acción solicitada
 */
function buscarCodigoNetflix(targetEmail, rawActionType) {
  const cleanTarget = targetEmail.trim().toLowerCase();
  const action = normalizarAccion(rawActionType);
  const netflixDomains = "from:account.netflix.com OR from:netflix.com OR from:mailer.netflix.com";

  let query = `to:${cleanTarget} (${netflixDomains})`;
  let threads = GmailApp.search(query, 0, 10);

  if (threads.length === 0) {
    query = `(${netflixDomains}) "${cleanTarget}"`;
    threads = GmailApp.search(query, 0, 10);
  }

  if (threads.length === 0) {
    return { success: false, message: "No se encontraron correos de Netflix para " + cleanTarget, actionType: action };
  }

  threads.sort((a, b) => b.getLastMessageDate().getTime() - a.getLastMessageDate().getTime());

  const allMessages = [];
  for (let i = 0; i < threads.length; i++) {
    const msgs = threads[i].getMessages();
    for (let j = 0; j < msgs.length; j++) {
      allMessages.push(msgs[j]);
    }
  }

  allMessages.sort((a, b) => b.getDate().getTime() - a.getDate().getTime());

  const now = new Date().getTime();
  const MAX_MESSAGE_AGE_MS = 15 * 60 * 1000; // Máximo 15 minutos

  for (let i = 0; i < allMessages.length; i++) {
    const message = allMessages[i];
    const msgDate = message.getDate().getTime();
    if (now - msgDate > MAX_MESSAGE_AGE_MS) continue;

    const rawTo = (message.getTo() || "").toLowerCase();
    const body = message.getPlainBody() || "";
    const htmlBody = message.getBody() || "";
    const subject = message.getSubject() || "";

    const actualRecipient = extraerDestinatarioExacto(rawTo, body, htmlBody);
    if (actualRecipient !== cleanTarget && !rawTo.includes(cleanTarget)) continue;

    const detectedAction = clasificarMensajeNetflix(subject, body, htmlBody);
    if (action && normalizarAccion(action) !== normalizarAccion(detectedAction)) {
      continue;
    }

    const codeOrLink = extraerPorAccionNetflix(subject, body, htmlBody, action);
    if (codeOrLink) {
      sendCodeToWebhook({
        account_email: cleanTarget,
        extracted_code: codeOrLink,
        action_type: action,
        raw_subject: subject,
        raw_body: (body || htmlBody).substring(0, 4000)
      });

      return {
        success: true,
        code: codeOrLink,
        email: cleanTarget,
        actionType: action,
        isLink: codeOrLink.startsWith("http://") || codeOrLink.startsWith("https://")
      };
    }
  }

  return { success: false, message: "No se encontró ningún correo reciente (últimos 15 min) para la opción: " + action, actionType: action };
}

/**
 * Clasifica con precisión el mensaje de Netflix en una de las 5 opciones
 */
function clasificarMensajeNetflix(subject, body, htmlBody) {
  const combined = (subject + " " + body).toLowerCase();

  // 1. Restablecer contraseña
  if (combined.includes("restablece tu contraseña") || combined.includes("restablecer contraseña") || 
      combined.includes("reset your password") || combined.includes("cambiar contraseña") ||
      (combined.includes("contraseña") && combined.includes("netflix"))) {
    return "reset_password";
  }

  // 2. Actualizar hogar
  if (combined.includes("actualizar tu hogar") || combined.includes("actualizar hogar") || 
      combined.includes("hogar con netflix") || combined.includes("update household") ||
      combined.includes("update-household") || combined.includes("red del hogar")) {
    return "actualizar_hogar";
  }

  // 3. Acceso temporal (Estoy de viaje / TV fuera de casa)
  if (combined.includes("código de acceso temporal") || combined.includes("acceso temporal") || 
      combined.includes("estás de viaje") || combined.includes("estoy de viaje") ||
      combined.includes("temporary access") || combined.includes("travel/verify") || combined.includes("verify-travel")) {
    return "acceso_temporal";
  }

  // 4. Código de verificación (dura 15 minutos)
  if (combined.includes("código de verificación") || combined.includes("codigo de verificacion") || 
      combined.includes("verificación") || combined.includes("verification code") ||
      combined.includes("15 minutos") || combined.includes("un solo uso") || combined.includes("one-time code")) {
    return "verification_code";
  }

  // 5. Código de inicio de sesión (TV / pantalla)
  if (combined.includes("iniciar sesión") || combined.includes("iniciar sesion") || 
      combined.includes("sign-in code") || combined.includes("código para iniciar") ||
      combined.includes("tu código para iniciar")) {
    return "login_code";
  }

  return "login_code";
}

/**
 * Extrae código de 4 dígitos, OTP o enlace según la opción de Netflix
 */
function extraerPorAccionNetflix(subject, body, htmlBody, actionType) {
  const normAction = normalizarAccion(actionType);
  const cleanBody = (body || "").replace(/=\r?\n/g, "");
  const fullText = subject + "\n" + cleanBody;

  // 1. ACTUALIZAR HOGAR (LINK)
  if (normAction === "actualizar_hogar") {
    if (htmlBody) {
      const btn = htmlBody.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:update-household|account\/update-household|email\/click|nmtr)[^"']*)["'][^>]*>[\s\S]*?(?:actualizar|hogar|sí|si|solicité|household)[\s\S]*?<\/a>/i) ||
                  htmlBody.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:update-household|account\/update-household)[^"']*)["']/i);
      if (btn && btn[1]) return btn[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
    }
    const textLink = cleanBody.match(/(https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:update-household|account\/update-household)[^\s"'<>]+)/i);
    if (textLink && textLink[1]) return textLink[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
  }

  // 2. ACCESO TEMPORAL (LINK)
  if (normAction === "acceso_temporal") {
    if (htmlBody) {
      const btn = htmlBody.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:account\/travel\/verify|travel\/verify|verify-travel|account\/travel|email\/click|nmtr)[^"']*)["'][^>]*>[\s\S]*?(?:obtener|enviar|código|codigo|viaje|temporal|acceso|confirmar|travel)[\s\S]*?<\/a>/i) ||
                  htmlBody.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:account\/travel\/verify|travel\/verify|verify-travel|account\/travel)[^"']*)["']/i);
      if (btn && btn[1]) return btn[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
    }
    const textLink = cleanBody.match(/(https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:account\/travel\/verify|travel\/verify|verify-travel|account\/travel)[^\s"'<>]+)/i);
    if (textLink && textLink[1]) return textLink[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
  }

  // 3. RESTABLECER CONTRASEÑA (LINK)
  if (normAction === "reset_password") {
    if (htmlBody) {
      const btn = htmlBody.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:password\?|account\/password|password\/|email\/click|nmtr)[^"']*)["'][^>]*>[\s\S]*?(?:restablecer|cambiar|reset|password|contraseña)[\s\S]*?<\/a>/i) ||
                  htmlBody.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:password\?|account\/password|password\/)[^"']*)["']/i);
      if (btn && btn[1]) return btn[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
    }
    const textLink = cleanBody.match(/(https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:password\?|account\/password|password\/)[^\s"'<>]+)/i);
    if (textLink && textLink[1]) return textLink[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
  }

  // 4. CÓDIGO DE INICIO DE SESIÓN (4 DÍGITOS PARA TV O PANTALLA)
  if (normAction === "login_code") {
    const spaced4 = fullText.match(/\b([0-9]\s+[0-9]\s+[0-9]\s+[0-9])\b/);
    if (spaced4 && spaced4[1]) return spaced4[1].replace(/\s+/g, "");

    const prefixed4 = fullText.match(/(?:código|code|pin|clave|acceso|iniciar\s+sesión)[\s\:\-]+([0-9]{4})\b/i) ||
                      fullText.match(/\b([0-9]{4})[\s]+(?:es tu código|is your code)/i);
    if (prefixed4 && prefixed4[1]) return prefixed4[1].trim();

    const four = fullText.match(/\b([0-9]{4})\b/);
    if (four && four[1]) return four[1].trim();
  }

  // 5. CÓDIGO DE VERIFICACIÓN (DURA 15 MINUTOS - OTP NUMÉRICO)
  if (normAction === "verification_code") {
    const prefixedOtp = fullText.match(/(?:verificación|verification|un\s+solo\s+uso|otp|código|code)[\s\:\-]+([0-9]{4,6})\b/i) ||
                        fullText.match(/\b([0-9]{4,6})[\s]+(?:es tu código|is your verification code)/i);
    if (prefixedOtp && prefixedOtp[1]) return prefixedOtp[1].trim();

    const spaced = fullText.match(/\b([0-9]\s+[0-9]\s+[0-9]\s+[0-9](?:\s+[0-9]\s+[0-9])?)\b/);
    if (spaced && spaced[1]) return spaced[1].replace(/\s+/g, "");

    const otpMatch = fullText.match(/\b([0-9]{4,6})\b/);
    if (otpMatch && otpMatch[1]) return otpMatch[1].trim();
  }

  return null;
}

/**
 * Extrae el destinatario exacto
 */
function extraerDestinatarioExacto(toHeader, body, htmlBody) {
  const match = toHeader.match(/<([^>]+)>/) || [null, toHeader];
  let email = (match[1] || toHeader).trim().toLowerCase().replace(/['"<>\s]/g, "");

  if (!email.includes("+")) {
    const combined = body + " " + htmlBody;
    const aliasMatch = combined.match(/([a-zA-Z0-9._%+-]+\+[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (aliasMatch && aliasMatch[1]) {
      return aliasMatch[1].trim().toLowerCase();
    }
  }

  return email;
}

/**
 * Envía el código al Webhook Next.js
 */
function sendCodeToWebhook(payload) {
  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Authorization": "Bearer " + CONFIG.WEBHOOK_SECRET
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
    const responseCode = response.getResponseCode();
    return responseCode >= 200 && responseCode < 300;
  } catch (error) {
    Logger.log("Error enviando al Webhook: " + error.toString());
    return false;
  }
}
