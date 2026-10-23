/**
 * GOOGLE APPS SCRIPT (GAS) - STREAMHUB / HOGARPRO
 * EXCLUSIVO NETFLIX - EXTRACTOR ESPECIALIZADO DE 5 ACCIONES
 * 
 * 1. Codigo de inicio de sesion (4 dígitos numéricos para TV / pantalla)
 * 2. Codigo de verificacion (dura 15 minutos - OTP numérico)
 * 3. Solicitar actualizar hogar netflix (link oficial directo)
 * 4. Codigo de acceso temporal (link oficial de viaje / fuera de casa)
 * 5. Reestablecer contraseña (link oficial directo para cambiar clave)
 * 
 * Instrucciones:
 * - Pega este script en tu proyecto de Google Apps Script.
 * - Despliega como Aplicación Web (Acceso: 'Cualquiera').
 */

const CONFIG = {
  BASE_URL: "https://hogarpro-xrhd.vercel.app",
  API_SECRET: (typeof PropertiesService !== "undefined" && PropertiesService.getScriptProperties().getProperty("API_SECRET")) || "token_ultra_secreto_para_proteger_endpoint_de_codigos_2026",
  NETFLIX_FROM: "from:account.netflix.com OR from:netflix.com OR from:mailer.netflix.com"
};

/**
 * Punto de entrada HTTP GET para el backend de Next.js (/api/codes/check)
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
 * Normaliza cualquier alias a las 5 acciones oficiales de Netflix
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
 * Genera palabras clave para priorizar la búsqueda en Gmail según la acción
 */
function obtenerQueryKeywords(action) {
  switch (action) {
    case "login_code":
      return '(subject:"iniciar sesión" OR subject:"iniciar sesion" OR subject:"sign-in" OR subject:"login code" OR subject:"código para iniciar")';
    case "verification_code":
      return '(subject:"código de verificación" OR subject:"codigo de verificacion" OR subject:"verificación" OR subject:"verification" OR subject:"un solo uso")';
    case "actualizar_hogar":
      return '(subject:"hogar" OR subject:"actualizar" OR subject:"household")';
    case "acceso_temporal":
      return '(subject:"temporal" OR subject:"viaje" OR subject:"travel")';
    case "reset_password":
      return '(subject:"contraseña" OR subject:"password" OR subject:"restablece" OR subject:"reset")';
    default:
      return "";
  }
}

/**
 * Busca correos en Gmail para el correo objetivo y la acción solicitada
 */
function buscarCodigoNetflix(targetEmail, rawActionType) {
  const cleanTarget = targetEmail.trim().toLowerCase();
  const action = normalizarAccion(rawActionType);
  const keywords = obtenerQueryKeywords(action);

  // 1. Búsqueda dirigida: to:correo (from:netflix...) (keywords de la acción)
  let query = `to:${cleanTarget} (${CONFIG.NETFLIX_FROM}) ${keywords}`.trim();
  Logger.log("Búsqueda dirigida en Gmail: " + query);
  let threads = GmailApp.search(query, 0, 10);

  // 2. Si no encuentra con keywords en el asunto, buscar todos los correos recientes de Netflix para ese destinatario
  if (threads.length === 0) {
    query = `to:${cleanTarget} (${CONFIG.NETFLIX_FROM})`;
    Logger.log("Búsqueda general por destinatario: " + query);
    threads = GmailApp.search(query, 0, 10);
  }

  // 3. Respaldo por comillas exactas (para alias o menciones en el cuerpo)
  if (threads.length === 0) {
    query = `(${CONFIG.NETFLIX_FROM}) "${cleanTarget}"`;
    Logger.log("Búsqueda con comillas: " + query);
    threads = GmailApp.search(query, 0, 10);
  }

  if (threads.length === 0) {
    return { 
      success: false, 
      message: "No se encontraron correos de Netflix recientes para " + cleanTarget,
      actionType: action 
    };
  }

  // Ordenar los hilos por fecha del último mensaje descendente
  threads.sort((a, b) => b.getLastMessageDate().getTime() - a.getLastMessageDate().getTime());

  return procesarHilosNetflix(threads, cleanTarget, action);
}

/**
 * Procesa los mensajes de los hilos encontrados y extrae el resultado exacto
 */
function procesarHilosNetflix(threads, targetEmail, requestedAction) {
  const allMessages = [];
  for (let i = 0; i < threads.length; i++) {
    const msgs = threads[i].getMessages();
    for (let j = 0; j < msgs.length; j++) {
      allMessages.push(msgs[j]);
    }
  }

  // Ordenar de más nuevo a más viejo
  allMessages.sort((a, b) => b.getDate().getTime() - a.getDate().getTime());

  const now = new Date().getTime();
  const MAX_MESSAGE_AGE_MS = 15 * 60 * 1000; // Estricto: últimos 15 minutos para evitar códigos obsoletos

  for (let i = 0; i < allMessages.length; i++) {
    const message = allMessages[i];
    const msgDate = message.getDate().getTime();

    // Descartar mensajes de más de 15 minutos
    if (now - msgDate > MAX_MESSAGE_AGE_MS) {
      continue;
    }

    const rawTo = (message.getTo() || "").toLowerCase();
    const body = message.getPlainBody() || "";
    const htmlBody = message.getBody() || "";
    const subject = message.getSubject() || "";

    // VALIDACIÓN ESTRICTA: Verificar que pertenezca al correo destinatario
    const actualRecipient = extraerDestinatarioExacto(rawTo, body, htmlBody);
    if (actualRecipient !== targetEmail && !rawTo.includes(targetEmail)) {
      continue;
    }

    // Clasificar el mensaje de Netflix
    const detectedAction = clasificarMensajeNetflix(subject, body, htmlBody);

    // Si el mensaje actual es de OTRA acción distinta a la pedida, NO devolverlo
    // (Ej: Si pidió login_code y llegó un email de reset de password, no confundirlos)
    if (requestedAction && !accionesCoinciden(requestedAction, detectedAction)) {
      continue;
    }

    const finalAction = requestedAction || detectedAction;
    const codeOrLink = extraerPorAccionNetflix(subject, body, htmlBody, finalAction);

    if (codeOrLink) {
      const isLink = codeOrLink.startsWith("http://") || codeOrLink.startsWith("https://");
      Logger.log(`[NETFLIX EXITO] ${targetEmail} | Acción: ${finalAction} -> ${codeOrLink}`);

      // Enviar de fondo al webhook de la web para persistir en Firestore y memoria
      enviarAlServidor(targetEmail, codeOrLink, finalAction, subject, body || htmlBody);

      return {
        success: true,
        code: codeOrLink,
        email: targetEmail,
        actionType: finalAction,
        isLink: isLink
      };
    }
  }

  return { 
    success: false, 
    message: "No se encontró ningún correo reciente (últimos 15 min) para la opción: " + requestedAction,
    actionType: requestedAction 
  };
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
 * Comprueba si la acción solicitada es compatible con la acción clasificada del correo
 */
function accionesCoinciden(requested, detected) {
  const req = normalizarAccion(requested);
  const det = normalizarAccion(detected);
  return req === det;
}

/**
 * Extrae con exactitud el código o enlace según la acción requerida de Netflix
 */
function extraerPorAccionNetflix(subject, body, htmlBody, actionType) {
  const normAction = normalizarAccion(actionType);
  const cleanBody = (body || "").replace(/=\r?\n/g, "");
  const fullText = subject + "\n" + cleanBody;

  // =========================================================================
  // 1. SOLICITAR ACTUALIZAR HOGAR NETFLIX (LINK)
  // =========================================================================
  if (normAction === "actualizar_hogar") {
    if (htmlBody) {
      // Buscar botón de actualización de hogar en el HTML
      const btn = htmlBody.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:update-household|account\/update-household|email\/click|nmtr)[^"']*)["'][^>]*>[\s\S]*?(?:actualizar|hogar|sí|si|solicité|household)[\s\S]*?<\/a>/i) ||
                  htmlBody.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:update-household|account\/update-household)[^"']*)["']/i);
      if (btn && btn[1]) {
        return btn[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
      }
    }
    // Buscar en texto
    const textLink = cleanBody.match(/(https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:update-household|account\/update-household)[^\s"'<>]+)/i);
    if (textLink && textLink[1]) {
      return textLink[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
    }
  }

  // =========================================================================
  // 2. CÓDIGO DE ACCESO TEMPORAL (LINK)
  // =========================================================================
  if (normAction === "acceso_temporal") {
    if (htmlBody) {
      // Buscar botón de acceso temporal / viaje en el HTML
      const btn = htmlBody.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:account\/travel\/verify|travel\/verify|verify-travel|account\/travel|email\/click|nmtr)[^"']*)["'][^>]*>[\s\S]*?(?:obtener|enviar|código|codigo|viaje|temporal|acceso|confirmar|travel)[\s\S]*?<\/a>/i) ||
                  htmlBody.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:account\/travel\/verify|travel\/verify|verify-travel|account\/travel)[^"']*)["']/i);
      if (btn && btn[1]) {
        return btn[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
      }
    }
    // Buscar en texto
    const textLink = cleanBody.match(/(https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:account\/travel\/verify|travel\/verify|verify-travel|account\/travel)[^\s"'<>]+)/i);
    if (textLink && textLink[1]) {
      return textLink[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
    }
  }

  // =========================================================================
  // 3. REESTABLECER CONTRASEÑA (LINK)
  // =========================================================================
  if (normAction === "reset_password") {
    if (htmlBody) {
      // Buscar botón de restablecer contraseña en el HTML
      const btn = htmlBody.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:password\?|account\/password|password\/|email\/click|nmtr)[^"']*)["'][^>]*>[\s\S]*?(?:restablecer|cambiar|reset|password|contraseña)[\s\S]*?<\/a>/i) ||
                  htmlBody.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:password\?|account\/password|password\/)[^"']*)["']/i);
      if (btn && btn[1]) {
        return btn[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
      }
    }
    // Buscar en texto
    const textLink = cleanBody.match(/(https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:password\?|account\/password|password\/)[^\s"'<>]+)/i);
    if (textLink && textLink[1]) {
      return textLink[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
    }
  }

  // =========================================================================
  // 4. CÓDIGO DE INICIO DE SESIÓN (4 DÍGITOS PARA TV O PANTALLA)
  // =========================================================================
  if (normAction === "login_code") {
    // A. Dígitos espaciados: "8 4 9 2"
    const spaced4 = fullText.match(/\b([0-9]\s+[0-9]\s+[0-9]\s+[0-9])\b/);
    if (spaced4 && spaced4[1]) {
      return spaced4[1].replace(/\s+/g, "");
    }

    // B. Código con prefijo de inicio o TV
    const prefixed4 = fullText.match(/(?:código|code|pin|clave|acceso|iniciar\s+sesión)[\s\:\-]+([0-9]{4})\b/i) ||
                      fullText.match(/\b([0-9]{4})[\s]+(?:es tu código|is your code)/i);
    if (prefixed4 && prefixed4[1]) {
      return prefixed4[1].trim();
    }

    // C. Secuencia aislada de exactamente 4 dígitos
    const codeMatch4 = fullText.match(/\b([0-9]{4})\b/);
    if (codeMatch4 && codeMatch4[1]) {
      return codeMatch4[1].trim();
    }
  }

  // =========================================================================
  // 5. CÓDIGO DE VERIFICACIÓN (DURA 15 MINUTOS - OTP NUMÉRICO)
  // =========================================================================
  if (normAction === "verification_code") {
    // A. Código con prefijo de verificación
    const prefixedOtp = fullText.match(/(?:verificación|verification|un\s+solo\s+uso|otp|código|code)[\s\:\-]+([0-9]{4,6})\b/i) ||
                        fullText.match(/\b([0-9]{4,6})[\s]+(?:es tu código|is your verification code)/i);
    if (prefixedOtp && prefixedOtp[1]) {
      return prefixedOtp[1].trim();
    }

    // B. Dígitos espaciados
    const spaced = fullText.match(/\b([0-9]\s+[0-9]\s+[0-9]\s+[0-9](?:\s+[0-9]\s+[0-9])?)\b/);
    if (spaced && spaced[1]) {
      return spaced[1].replace(/\s+/g, "");
    }

    // C. Secuencia aislada de 4 a 6 dígitos
    const otpMatch = fullText.match(/\b([0-9]{4,6})\b/);
    if (otpMatch && otpMatch[1]) {
      return otpMatch[1].trim();
    }
  }

  return null;
}

/**
 * Extrae el destinatario exacto del header o de alias plus-addressing
 */
function extraerDestinatarioExacto(toHeader, body, htmlBody) {
  const match = toHeader.match(/<([^>]+)>/) || [null, toHeader];
  let email = (match[1] || toHeader).trim().toLowerCase();
  email = email.replace(/['"<>\s]/g, "");

  // Si el To no tiene alias pero el body sí lo menciona
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
 * Envía el código extraído al Webhook central de Next.js
 */
function enviarAlServidor(email, codeOrLink, actionType, subject, body) {
  const targetUrl = CONFIG.BASE_URL + "/api/webhooks/incoming-code";
  const payload = {
    account_email: email,
    extracted_code: codeOrLink,
    action_type: actionType,
    raw_subject: subject,
    raw_body: body ? body.substring(0, 4000) : ""
  };

  try {
    UrlFetchApp.fetch(targetUrl, {
      method: "post",
      contentType: "application/json",
      headers: { "Authorization": "Bearer " + CONFIG.API_SECRET },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (e) {
    Logger.log("Error enviando al webhook: " + e.message);
  }
}
