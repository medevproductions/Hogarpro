/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT (GAS) - STREAMHUB / HOGARPRO
 * Extractor y Sincronizador Automático de Códigos de Streaming en Tiempo Real
 * ==============================================================================
 */

const CONFIG = {
  BASE_URL: "https://hogarpro-xrhd.vercel.app",
  API_SECRET: "token_ultra_secreto_para_proteger_endpoint_de_codigos_2026",
  SEARCH_QUERY: "is:unread (from:account.netflix.com OR from:netflix.com OR from:disneyplus.com OR from:hbomax.com OR from:max.com OR from:primevideo.com OR from:spotify.com)",
  MAX_THREADS: 15
};

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
        const rawTo = message.getTo();
        const toEmail = extractCleanEmail(rawTo, body);
        
        const actionType = detectActionType(subject, body);
        const extractedCode = extractCodeOrLink(subject, body, actionType);

        if (toEmail && extractedCode) {
          Logger.log(`>>> Código REAL detectado [${actionType}] para ${toEmail}: "${extractedCode}"`);

          const success = dispatchCodeToApi(toEmail, extractedCode, actionType, subject, body);

          if (success) {
            message.markRead();
            Logger.log(`Mensaje procesado con éxito para: ${toEmail}`);
          }
        }
      }
    }
  }
}

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
  return "login_code";
}

/**
 * Extracción de código real adaptado al formato exacto de Netflix (ej: "9 1 8 3" o "9183")
 */
function extractCodeOrLink(subject, body, actionType) {
  const fullText = subject + "\n" + body;

  // 1. Caso Netflix con espacios entre dígitos: "9 1 8 3" o "9 1 8 3 2 0"
  // Ejemplo: En el email viene escrito "9 1 8 3"
  const spacedDigits = fullText.match(/\b([0-9]\s+[0-9]\s+[0-9]\s+[0-9](?:\s+[0-9])?(?:\s+[0-9])?)\b/);
  if (spacedDigits && spacedDigits[1]) {
    // Eliminar espacios intermedios -> devuelve "9183"
    return spacedDigits[1].replace(/\s+/g, "");
  }

  // 2. Patrones estándar de dígitos juntos (4 a 8 dígitos)
  // Ejemplos: "Ingresa este código para iniciar sesión 9183", "Código: 8492"
  const codeMatch = fullText.match(/(?:código|code|clave|pin|iniciar sesión)[\s\:\-]+([0-9]{4,8})/i) ||
                    fullText.match(/([0-9]{4,8})[\s]+(?:es tu código|is your code|ingresa este código)/i) ||
                    fullText.match(/\b([0-9]{4,6})\b/);

  if (codeMatch && codeMatch[1]) {
    return codeMatch[1].trim();
  }

  // 3. Si no hay dígitos y es link:
  const linkMatch = fullText.match(/(https:\/\/(?:www\.)?(?:netflix|disneyplus|max|primevideo)\.com\/[^\s\>\"]+)/i) ||
                    fullText.match(/(https:\/\/[^\s\>\"]+verify[^\s\>\"]*)/i);
  if (linkMatch && linkMatch[1]) {
    return linkMatch[1].trim();
  }

  return null;
}

/**
 * Limpia el correo y preserva exactamente el alias (ej: hogaryutu+acido@gmail.com)
 */
function extractCleanEmail(toHeader, body) {
  // Primero buscar en el header To:
  const match = toHeader.match(/<([^>]+)>/) || [null, toHeader];
  let email = match[1] ? match[1].trim().toLowerCase() : toHeader.trim().toLowerCase();

  // Si no trae alias en el header, buscar en el cuerpo si Netflix puso "para correo+alias@..."
  if (!email.includes("+")) {
    const bodyAliasMatch = body.match(/([a-zA-Z0-9._%+-]+\+[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (bodyAliasMatch && bodyAliasMatch[1]) {
      return bodyAliasMatch[1].toLowerCase().trim();
    }
  }

  return email;
}

function dispatchCodeToApi(accountEmail, code, actionType, subject, body) {
  const endpointMap = {
    actualizar: "/api/codes/actualizar",
    temporal: "/api/codes/temporal",
    login_code: "/api/codes/login-code",
    login_confirm: "/api/codes/login-confirm",
    reset_password: "/api/codes/reset-password"
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
