/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT (GAS) - STREAMHUB / HOGARPRO
 * Extractor y Sincronizador Automático de Códigos de Streaming en Tiempo Real
 * ==============================================================================
 */

const CONFIG = {
  // Tu dominio de Vercel oficial
  BASE_URL: "https://hogarpro-xrhd.vercel.app",

  // Token secreto configurado en el backend
  API_SECRET: "token_ultra_secreto_para_proteger_endpoint_de_codigos_2026",

  // Búsqueda inteligente de correos no leídos de plataformas de streaming
  SEARCH_QUERY: "is:unread (from:netflix.com OR from:disneyplus.com OR from:hbomax.com OR from:max.com OR from:primevideo.com OR from:spotify.com)",
  MAX_THREADS: 15
};

/**
 * FUNCIÓN PRINCIPAL:
 * Ejecuta este método o configúralo con un Activador (Trigger) de tiempo cada 1 minuto.
 */
function processIncomingEmails() {
  const threads = GmailApp.search(CONFIG.SEARCH_QUERY, 0, CONFIG.MAX_THREADS);
  Logger.log(`Hilos de correo no leídos encontrados: ${threads.length}`);

  for (let i = 0; i < threads.length; i++) {
    const messages = threads[i].getMessages();

    for (let j = 0; j < messages.length; j++) {
      const message = messages[j];

      if (message.isUnread()) {
        const subject = message.getSubject();
        const body = message.getPlainBody();
        const toEmail = extractCleanEmail(message.getTo(), body);
        
        // 1. Detectar tipo de acción
        const actionType = detectActionType(subject, body);

        // 2. Extraer código de 4/6/8 dígitos o URL de verificación
        const extractedCode = extractCodeOrLink(subject, body, actionType);

        if (toEmail && extractedCode) {
          Logger.log(`Código detectado [${actionType}] para ${toEmail}: ${extractedCode}`);

          // 3. Enviar al endpoint correspondiente en Vercel
          const success = dispatchCodeToApi(toEmail, extractedCode, actionType, subject, body);

          if (success) {
            message.markRead(); // Marcar como leído para no reenviarlo
            Logger.log(`Mensaje procesado y marcado como leído para: ${toEmail}`);
          }
        }
      }
    }
  }
}

/**
 * Identifica la acción requerida según el asunto y cuerpo del correo
 */
function detectActionType(subject, body) {
  const text = (subject + " " + body).toLowerCase();

  if (text.includes("restablecer") || text.includes("reset password") || text.includes("cambiar contraseña") || text.includes("actualiza tu contraseña")) {
    return "reset_password";
  }
  if (text.includes("actualizar hogar") || text.includes("update household") || text.includes("red principal") || text.includes("tu hogar con netflix")) {
    return "actualizar";
  }
  if (text.includes("temporal") || text.includes("código temporal") || text.includes("viaje") || text.includes("travel") || text.includes("estoy de viaje")) {
    return "temporal";
  }
  if (text.includes("confirmar inicio") || text.includes("aceptar acceso") || text.includes("aprobar") || text.includes("iniciar sesión desde")) {
    return "login_confirm";
  }
  return "login_code"; // Por defecto OTP rápido de acceso
}

/**
 * Extrae el código numérico (Regex) o enlace de confirmación
 */
function extractCodeOrLink(subject, body, actionType) {
  const fullText = subject + "\n" + body;

  // 1. Si es enlace de actualización, confirmación o reset:
  if (actionType === "actualizar" || actionType === "login_confirm" || actionType === "reset_password") {
    const linkMatch = fullText.match(/(https:\/\/(?:www\.)?(?:netflix|disneyplus|max|primevideo)\.com\/[^\s\>\"]+)/i) ||
                      fullText.match(/(https:\/\/[^\s\>\"]+verify[^\s\>\"]*)/i) ||
                      fullText.match(/(https:\/\/[^\s\>\"]+travel[^\s\>\"]*)/i);
    if (linkMatch && linkMatch[1]) {
      return linkMatch[1].trim();
    }
  }

  // 2. Patrones Regex para códigos numéricos (4 a 8 dígitos)
  // Ejemplos: "Tu código es 8492", "Código de acceso: 382910", "Código: 5821"
  const codeMatch = fullText.match(/(?:código|code|clave|pin|código de acceso)[\s\:\-]+([0-9]{4,8})/i) ||
                    fullText.match(/([0-9]{4,8})[\s]+(?:es tu código|is your code)/i) ||
                    fullText.match(/\b([0-9]{4,6})\b/);

  if (codeMatch && codeMatch[1]) {
    return codeMatch[1].trim();
  }

  return null;
}

/**
 * Limpia y normaliza el correo receptor
 */
function extractCleanEmail(toHeader, body) {
  const match = toHeader.match(/<([^>]+)>/) || [null, toHeader];
  let email = match[1] ? match[1].trim().toLowerCase() : toHeader.trim().toLowerCase();
  return email;
}

/**
 * Realiza la petición HTTP POST a tu web en Vercel
 */
function dispatchCodeToApi(accountEmail, code, actionType, subject, body) {
  // Rutas cortas configuradas en tu Vercel
  const endpointMap = {
    actualizar: "/actualizar",
    temporal: "/temporal",
    login_code: "/codigo",
    login_confirm: "/confirmar",
    reset_password: "/clave"
  };

  const targetUrl = CONFIG.BASE_URL + (endpointMap[actionType] || "/api/webhooks/incoming-code");

  const payload = {
    account_email: accountEmail,
    extracted_code: code,
    action_type: actionType,
    raw_subject: subject,
    raw_body: body ? body.substring(0, 300) : ""
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Authorization": "Bearer " + CONFIG.API_SECRET
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(targetUrl, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();
    Logger.log(`Envío a ${targetUrl} - HTTP ${responseCode}: ${responseBody}`);
    return responseCode >= 200 && responseCode < 300;
  } catch (err) {
    Logger.log(`Error al enviar HTTP a Vercel: ${err.toString()}`);
    return false;
  }
}
