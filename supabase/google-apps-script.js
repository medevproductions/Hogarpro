/**
 * GOOGLE APPS SCRIPT (GAS) - EXTRACTOR AUTOMÁTICO DE CÓDIGOS DE STREAMING
 * 
 * Instrucciones de configuración:
 * 1. Abre https://script.google.com/
 * 2. Crea un nuevo proyecto y pega este código.
 * 3. Configura las variables WEBHOOK_URL y WEBHOOK_SECRET.
 * 4. Configura un "Activador" (Trigger) basado en tiempo (ej: cada 1 minuto) o al recibir correos.
 */

const CONFIG = {
  WEBHOOK_URL: "https://tu-proyecto.vercel.app/api/webhooks/incoming-code",
  WEBHOOK_SECRET: "TU_TOKEN_SECRETO_SEGURO_AQUI", // Debe coincidir con WEBHOOK_SECRET en tu .env.local
  SEARCH_QUERY: "is:unread (from:netflix.com OR from:disneyplus.com OR from:hbomax.com OR from:max.com OR from:primevideo.com OR from:spotify.com)",
  MAX_THREADS: 10
};

/**
 * Función principal que busca y procesa correos no leídos
 */
function processIncomingStreamingEmails() {
  const threads = GmailApp.search(CONFIG.SEARCH_QUERY, 0, CONFIG.MAX_THREADS);
  
  for (let i = 0; i < threads.length; i++) {
    const messages = threads[i].getMessages();
    
    for (let j = 0; j < messages.length; j++) {
      const message = messages[j];
      if (message.isUnread()) {
        const subject = message.getSubject();
        const body = message.getPlainBody();
        const toEmail = extractTargetEmail(message.getTo(), body);
        const fromEmail = message.getFrom();
        const extractedCode = extractCodeFromContent(subject, body, fromEmail);
        const codeType = identifyCodeType(subject, body);
        
        if (extractedCode && toEmail) {
          Logger.log(`Código detectado: ${extractedCode} para ${toEmail} (${codeType})`);
          
          const success = sendCodeToWebhook({
            account_email: toEmail,
            extracted_code: extractedCode,
            request_type: codeType,
            raw_email_subject: subject,
            raw_email_body: body.substring(0, 500) // Primeros 500 caracteres para auditoría
          });
          
          if (success) {
            message.markRead(); // Marcar como leído solo si se envió con éxito
          }
        }
      }
    }
  }
}

/**
 * Extrae el correo de la cuenta receptora (incluso si viene con alias/plus-addressing)
 */
function extractTargetEmail(toHeader, body) {
  // 1. Extraer del Header To:
  const match = toHeader.match(/<([^>]+)>/) || [null, toHeader];
  let email = match[1].trim().toLowerCase();
  
  // Limpiar posibles sufijos de reenvío
  return email;
}

/**
 * Identifica el tipo de código según el contexto del correo
 */
function identifyCodeType(subject, body) {
  const text = (subject + " " + body).toLowerCase();
  if (text.includes("hogar") || text.includes("household") || text.includes("temporal") || text.includes("viaje")) {
    return "household_update";
  }
  if (text.includes("restablecer") || text.includes("reset") || text.includes("contraseña") || text.includes("password")) {
    return "reset_password";
  }
  if (text.includes("iniciar sesión") || text.includes("sign-in") || text.includes("acceso")) {
    return "access_code";
  }
  return "verification";
}

/**
 * Expresiones regulares para extraer códigos de 4, 6 u 8 dígitos o enlaces temporales
 */
function extractCodeFromContent(subject, body, from) {
  const fullText = subject + "\n" + body;

  // 1. Patrones estándar de dígitos aislados (4 a 8 dígitos)
  // Ejemplos: "Tu código de Netflix es: 849201", "Código: 4892", "382910 es tu código de un solo uso"
  const digitMatches = fullText.match(/(?:código|code|pin|clave|acceso|verificación)[\s\:\-]+([0-9]{4,8})/i) ||
                       fullText.match(/([0-9]{4,8})[\s]+(?:es tu código|is your code)/i) ||
                       fullText.match(/\b([0-9]{4,6})\b/);

  if (digitMatches && digitMatches[1]) {
    return digitMatches[1].trim();
  }

  // 2. Enlaces de confirmación de hogar (Netflix Update Household URL)
  const urlMatch = fullText.match(/(https:\/\/(?:www\.)?netflix\.com\/account\/travel\/verify[^\s\>\"]+)/i) ||
                   fullText.match(/(https:\/\/(?:www\.)?disneyplus\.com\/[^\s\>\"]+)/i);

  if (urlMatch && urlMatch[1]) {
    return urlMatch[1].trim();
  }

  return null;
}

/**
 * Envía la información al Webhook de la aplicación Next.js
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
    const responseText = response.getContentText();
    
    Logger.log(`Webhook HTTP ${responseCode}: ${responseText}`);
    return responseCode >= 200 && responseCode < 300;
  } catch (error) {
    Logger.log("Error enviando al Webhook: " + error.toString());
    return false;
  }
}
