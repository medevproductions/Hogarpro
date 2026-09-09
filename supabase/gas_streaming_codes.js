/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT (GAS) - STREAMHUB / HOGARPRO (ULTRA RÁPIDO)
 * Busca ÚNICAMENTE en los últimos 10 minutos para ejecuciones de 1 a 2 segundos
 * ==============================================================================
 */

const CONFIG = {
  BASE_URL: "https://hogarpro-xrhd.vercel.app",
  API_SECRET: "token_ultra_secreto_para_proteger_endpoint_de_codigos_2026",
  // Máximo 5 hilos recientes para no sobrecargar Gmail
  MAX_THREADS: 5,
  // Ventana de tiempo: últimos 10 minutos (en segundos)
  TIME_WINDOW_SECONDS: 10 * 60 
};

// Mapeo de dominios según servicio seleccionado
const SERVICE_DOMAINS = {
  netflix: "from:account.netflix.com OR from:netflix.com",
  disney: "from:disneyplus.com OR from:disney.com",
  max: "from:max.com OR from:hbomax.com",
  prime: "from:primevideo.com OR from:amazon.com",
  spotify: "from:spotify.com",
  crunchyroll: "from:crunchyroll.com",
  all: "from:account.netflix.com OR from:netflix.com OR from:disneyplus.com OR from:hbomax.com OR from:max.com OR from:primevideo.com OR from:spotify.com"
};

/**
 * Webhook HTTP (doGet / doPost): Permite consultar el correo BAJO DEMANDA
 * cada vez que un usuario introduce su correo+embudo en la web.
 */
function doGet(e) {
  const email = (e && e.parameter && e.parameter.email) ? e.parameter.email.trim().toLowerCase() : "";
  const service = (e && e.parameter && e.parameter.service) ? e.parameter.service.trim().toLowerCase() : "all";

  if (!email) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "email parameter is required" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const result = searchAndProcessRecipientEmail(email, service);
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const email = data.email ? data.email.trim().toLowerCase() : "";
    const service = data.service ? data.service.trim().toLowerCase() : "all";

    if (!email) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "email is required" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const result = searchAndProcessRecipientEmail(email, service);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Búsqueda Ultra Precisa y Focalizada:
 * Busca correos en los últimos 10 minutos dirigidos a ESTE correo+embudo y del servicio elegido
 */
function searchAndProcessRecipientEmail(targetRecipientEmail, serviceKey) {
  const tenMinutesAgo = Math.floor((new Date().getTime() / 1000) - CONFIG.TIME_WINDOW_SECONDS);
  const domainFilter = SERVICE_DOMAINS[serviceKey] || SERVICE_DOMAINS.all;
  
  // Gmail query específico: to:hogaryutu+acido@gmail.com after:... from:(servicio)
  const searchQuery = `to:${targetRecipientEmail} after:${tenMinutesAgo} (${domainFilter})`;
  Logger.log(`Ejecutando búsqueda bajo demanda: ${searchQuery}`);

  const threads = GmailApp.search(searchQuery, 0, 3);
  if (threads.length === 0) {
    // Fallback: buscar sin el to: por si Gmail indexa el alias en el body
    const fallbackQuery = `after:${tenMinutesAgo} (${domainFilter}) "${targetRecipientEmail}"`;
    const fallbackThreads = GmailApp.search(fallbackQuery, 0, 3);
    if (fallbackThreads.length > 0) {
      return processThreadList(fallbackThreads, targetRecipientEmail);
    }
    return { success: false, message: "No se encontraron correos recientes para este destinatario y servicio" };
  }

  return processThreadList(threads, targetRecipientEmail);
}

function processThreadList(threads, targetRecipientEmail) {
  for (let i = 0; i < threads.length; i++) {
    const messages = threads[i].getMessages();
    for (let j = 0; j < messages.length; j++) {
      const message = messages[j];
      const subject = message.getSubject();
      const body = message.getPlainBody();
      const rawTo = message.getTo();
      const recipientEmail = getExactRecipientEmail(rawTo, body);

      // Verificar que coincida con el receptor solicitado (o si target no fue dado)
      if (!targetRecipientEmail || recipientEmail === targetRecipientEmail.toLowerCase()) {
        const code = extractNetflixCode(subject, body);
        const actionType = detectActionType(subject, body);

        if (code) {
          Logger.log(`[ENCONTRADO] ${recipientEmail} -> ${code}`);
          const sent = dispatchCodeToApi(recipientEmail, code, actionType, subject, body);
          if (sent) {
            message.markRead();
          }
          return { success: true, code: code, email: recipientEmail, actionType: actionType };
        }
      }
    }
  }
  return { success: false, message: "Correo encontrado pero sin código detectable aún" };
}

/**
 * Función principal que ejecuta el activador automático
 * Busca correos entrantes de streaming que tengan destinatario con embudo (+alias)
 */
/**
 * Búsqueda manual o de prueba:
 * Permite buscar el código de tu correo exacto directamente desde Google Apps Script
 */
function buscarMiCodigo() {
  // Cambia el correo por el que quieras buscar:
  const miCorreo = "hogaryutu+acido@gmail.com";
  const miPlataforma = "netflix";
  
  Logger.log(`Buscando código para ${miCorreo}...`);
  const resultado = searchAndProcessRecipientEmail(miCorreo, miPlataforma);
  Logger.log(`Resultado: ${JSON.stringify(resultado)}`);
}

function getExactRecipientEmail(toHeader, body) {
  const match = toHeader.match(/<([^>]+)>/) || [null, toHeader];
  let email = (match[1] || toHeader).trim().toLowerCase();
  email = email.replace(/['"<>\s]/g, "");

  if (!email.includes("+")) {
    const bodyMatch = body.match(/([a-zA-Z0-9._%+-]+\+[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (bodyMatch && bodyMatch[1]) {
      return bodyMatch[1].trim().toLowerCase();
    }
  }

  return email;
}

function extractNetflixCode(subject, body) {
  const fullText = subject + "\n" + body;

  // Dígitos espaciados de Netflix: "3 5 9 7"
  const spacedMatch = fullText.match(/(?:iniciar sesión|código|code|código temporal|temporal)[\s\S]*?\b([0-9]\s+[0-9]\s+[0-9]\s+[0-9](?:\s+[0-9])?(?:\s+[0-9])?)\b/i) ||
                      fullText.match(/\b([0-9]\s+[0-9]\s+[0-9]\s+[0-9](?:\s+[0-9])?(?:\s+[0-9])?)\b/);

  if (spacedMatch && spacedMatch[1]) {
    const cleanDigits = spacedMatch[1].replace(/\s+/g, "");
    if (cleanDigits.length >= 4 && cleanDigits.length <= 8) {
      return cleanDigits;
    }
  }

  // Dígitos continuos
  const continuousMatch = fullText.match(/(?:código|code|clave|pin|código de acceso)[\s\:\-]+([0-9]{4,8})/i) ||
                          fullText.match(/([0-9]{4,8})[\s]+(?:es tu código|is your code|ingresa este código)/i) ||
                          fullText.match(/\b([0-9]{4,6})\b/);

  if (continuousMatch && continuousMatch[1]) {
    return continuousMatch[1].trim();
  }

  // Enlace
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
  return "login_code";
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
    Logger.log(`Enviando código a API: ${targetUrl} para ${accountEmail}...`);
    const response = UrlFetchApp.fetch(targetUrl, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    Logger.log(`Respuesta API (${responseCode}): ${responseText}`);
    return responseCode >= 200 && responseCode < 300;
  } catch (err) {
    Logger.log(`Error al enviar a API: ${err.message}`);
    return false;
  }
}
