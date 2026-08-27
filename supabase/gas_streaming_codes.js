/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT (GAS) - EXTRACTOR AUTOMÁTICO DE CÓDIGOS DE STREAMING
 * ==============================================================================
 * Soporta las 5 acciones clave:
 * 1. Actualizar (Actualización de hogar principal)
 * 2. Temporal (Código de TV fuera de casa / viaje)
 * 3. login_code (Código OTP numérico de inicio de sesión)
 * 4. login_confirm (Aceptar acceso / Confirmación de inicio)
 * 5. reset_password (Restablecimiento de contraseña)
 */

const CONFIG = {
  // Tu dominio de Vercel (o localhost mediante ngrok/localtunnel durante pruebas)
  BASE_URL: "https://tu-proyecto.vercel.app",
  API_SECRET: "token_ultra_secreto_para_proteger_endpoint_de_codigos_2026",
  SEARCH_QUERY: "is:unread (from:netflix.com OR from:disneyplus.com OR from:hbomax.com OR from:max.com OR from:primevideo.com OR from:spotify.com)",
  MAX_THREADS: 10
};

/**
 * Función que se ejecuta automáticamente mediante un Activador (Trigger) cada 1 minuto
 */
function processIncomingEmails() {
  const threads = GmailApp.search(CONFIG.SEARCH_QUERY, 0, CONFIG.MAX_THREADS);

  for (let i = 0; i < threads.length; i++) {
    const messages = threads[i].getMessages();

    for (let j = 0; j < messages.length; j++) {
      const message = messages[j];

      if (message.isUnread()) {
        const subject = message.getSubject();
        const body = message.getPlainBody();
        const toEmail = extractCleanEmail(message.getTo(), body);
        
        // Detectar tipo de acción y extraer código/enlace
        const actionType = detectActionType(subject, body);
        const extractedCode = extractCodeOrLink(subject, body, actionType);

        if (toEmail && extractedCode) {
          Logger.log(`Procesando [${actionType}] para ${toEmail}: ${extractedCode}`);

          // Enviar al endpoint individual o al general
          const success = dispatchCodeToApi(toEmail, extractedCode, actionType, subject, body);

          if (success) {
            message.markRead(); // Marcar como leído para no reprocesar
          }
        }
      }
    }
  }
}

/**
 * Detecta cuál de las 5 acciones corresponde el correo
 */
function detectActionType(subject, body) {
  const text = (subject + " " + body).toLowerCase();

  if (text.includes("restablecer") || text.includes("reset password") || text.includes("cambiar contraseña")) {
    return "reset_password";
  }
  if (text.includes("actualizar hogar") || text.includes("update household") || text.includes("red principal")) {
    return "actualizar";
  }
  if (text.includes("código temporal") || text.includes("temporal") || text.includes("viaje") || text.includes("travel")) {
    return "temporal";
  }
  if (text.includes("confirmar") || text.includes("aceptar acceso") || text.includes("iniciar sesión desde") || text.includes("aprobar")) {
    return "login_confirm";
  }
  return "login_code"; // Por defecto OTP de inicio de sesión
}

/**
 * Extrae el código numérico (Regex) o enlace URL según la acción
 */
function extractCodeOrLink(subject, body, actionType) {
  const fullText = subject + "\n" + body;

  // Si es confirmación, actualización o reset, buscar enlaces
  if (actionType === "actualizar" || actionType === "login_confirm" || actionType === "reset_password") {
    const linkMatch = fullText.match(/(https:\/\/(?:www\.)?(?:netflix|disneyplus|max|primevideo)\.com\/[^\s\>\"]+)/i) ||
                      fullText.match(/(https:\/\/[^\s\>\"]+verify[^\s\>\"]*)/i);
    if (linkMatch && linkMatch[1]) {
      return linkMatch[1].trim();
    }
  }

  // Patrones Regex para códigos numéricos de 4, 6 u 8 dígitos
  const codeMatch = fullText.match(/(?:código|code|clave|pin)[\s\:\-]+([0-9]{4,8})/i) ||
                    fullText.match(/([0-9]{4,8})[\s]+(?:es tu código|is your code)/i) ||
                    fullText.match(/\b([0-9]{4,6})\b/);

  if (codeMatch && codeMatch[1]) {
    return codeMatch[1].trim();
  }

  return null;
}

/**
 * Limpia el encabezado To: para obtener el correo puro
 */
function extractCleanEmail(toHeader, body) {
  const match = toHeader.match(/<([^>]+)>/) || [null, toHeader];
  return match[1] ? match[1].trim().toLowerCase() : toHeader.trim().toLowerCase();
}

/**
 * Realiza la petición HTTP POST hacia tu backend en Next.js
 */
function dispatchCodeToApi(accountEmail, code, actionType, subject, body) {
  // Mapeo hacia los endpoints individuales
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
    raw_body: body.substring(0, 300)
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
    const code = response.getResponseCode();
    Logger.log(`Respuesta HTTP ${code}: ${response.getContentText()}`);
    return code >= 200 && code < 300;
  } catch (err) {
    Logger.log(`Error en fetch HTTP: ${err.toString()}`);
    return false;
  }
}
