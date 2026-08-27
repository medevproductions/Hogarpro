/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT (GAS) - STREAMHUB / HOGARPRO
 * Extractor Directo por Receptor Exacto (+alias) y Códigos Espaciados
 * ==============================================================================
 */

const CONFIG = {
  BASE_URL: "https://hogarpro-xrhd.vercel.app",
  API_SECRET: "token_ultra_secreto_para_proteger_endpoint_de_codigos_2026",
  SEARCH_QUERY: "is:unread (from:account.netflix.com OR from:netflix.com OR from:disneyplus.com OR from:hbomax.com OR from:max.com OR from:primevideo.com OR from:spotify.com)",
  MAX_THREADS: 20
};

/**
 * Función principal activada automáticamente cada minuto
 */
function processIncomingEmails() {
  const threads = GmailApp.search(CONFIG.SEARCH_QUERY, 0, CONFIG.MAX_THREADS);
  Logger.log(`Hilos no leídos encontrados: ${threads.length}`);

  for (let i = 0; i < threads.length; i++) {
    const messages = threads[i].getMessages();

    for (let j = 0; j < messages.length; j++) {
      const message = messages[j];

      if (message.isUnread()) {
        const subject = message.getSubject();
        const body = message.getPlainBody();
        const rawTo = message.getTo(); // Exacto: "hogaryutu+acido@gmail.com"
        
        // 1. Extraer el correo EXACTO del receptor con su alias (+acido)
        const recipientEmail = getExactRecipientEmail(rawTo, body);
        
        // 2. Extraer el código exacto de Netflix (ej: "3 5 9 7" -> "3597")
        const code = extractNetflixCode(subject, body);
        const actionType = detectActionType(subject, body);

        if (recipientEmail && code) {
          Logger.log(`[EXITO] Receptor: ${recipientEmail} | Código extraído: ${code} | Acción: ${actionType}`);

          const success = dispatchCodeToApi(recipientEmail, code, actionType, subject, body);

          if (success) {
            message.markRead(); // Marcar como leído
            Logger.log(`Procesado y marcado como leído: ${recipientEmail}`);
          }
        }
      }
    }
  }
}

/**
 * Extrae el correo EXACTO del campo Para: (conserva +alias / embudos)
 */
function getExactRecipientEmail(toHeader, body) {
  // 1. Extraer de la cabecera To: ej: "hogaryutu+acido@gmail.com" o "Nombre <hogaryutu+acido@gmail.com>"
  const match = toHeader.match(/<([^>]+)>/) || [null, toHeader];
  let email = (match[1] || toHeader).trim().toLowerCase();

  // Limpiar posibles comillas o espacios
  email = email.replace(/['"<>\s]/g, "");

  // 2. Si no tiene alias en la cabecera, buscar si el cuerpo menciona el alias
  if (!email.includes("+")) {
    const bodyMatch = body.match(/([a-zA-Z0-9._%+-]+\+[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (bodyMatch && bodyMatch[1]) {
      return bodyMatch[1].trim().toLowerCase();
    }
  }

  return email;
}

/**
 * Extrae con precisión el código de Netflix tanto espaciado como continuo
 * Ejemplos capturados:
 *  - "3 5 9 7" -> "3597"
 *  - "9 1 8 3" -> "9183"
 *  - "482019" -> "482019"
 */
function extractNetflixCode(subject, body) {
  const fullText = subject + "\n" + body;

  // 1. Patrón prioritario Netflix: 4, 6 u 8 dígitos separados por espacios ("3 5 9 7")
  const spacedMatch = fullText.match(/(?:iniciar sesión|código|code|código temporal|temporal)[\s\S]*?\b([0-9]\s+[0-9]\s+[0-9]\s+[0-9](?:\s+[0-9])?(?:\s+[0-9])?)\b/i) ||
                      fullText.match(/\b([0-9]\s+[0-9]\s+[0-9]\s+[0-9](?:\s+[0-9])?(?:\s+[0-9])?)\b/);

  if (spacedMatch && spacedMatch[1]) {
    const cleanDigits = spacedMatch[1].replace(/\s+/g, "");
    if (cleanDigits.length >= 4 && cleanDigits.length <= 8) {
      return cleanDigits;
    }
  }

  // 2. Patrón de 4 a 8 dígitos seguidos ("3597" o "9183")
  const continuousMatch = fullText.match(/(?:código|code|clave|pin|código de acceso)[\s\:\-]+([0-9]{4,8})/i) ||
                          fullText.match(/([0-9]{4,8})[\s]+(?:es tu código|is your code|ingresa este código)/i) ||
                          fullText.match(/\b([0-9]{4,6})\b/);

  if (continuousMatch && continuousMatch[1]) {
    return continuousMatch[1].trim();
  }

  // 3. Enlace de confirmación si no hay código numérico
  const linkMatch = fullText.match(/(https:\/\/(?:www\.)?(?:netflix|disneyplus|max|primevideo)\.com\/[^\s\>\"]+)/i) ||
                    fullText.match(/(https:\/\/[^\s\>\"]+verify[^\s\>\"]*)/i);
  if (linkMatch && linkMatch[1]) {
    return linkMatch[1].trim();
  }

  return null;
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
  if (text.includes("confirmar inicio") || text.includes("aceptar acceso") || text.includes("aprobar")) {
    return "login_confirm";
  }
  return "login_code"; // Por defecto inicio de sesión
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
    Logger.log(`Respuesta de Vercel (${targetUrl}) - HTTP ${responseCode}: ${responseBody}`);
    return responseCode >= 200 && responseCode < 300;
  } catch (err) {
    Logger.log(`Error al enviar HTTP a Vercel: ${err.toString()}`);
    return false;
  }
}
