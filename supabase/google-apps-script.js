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
        const htmlBody = message.getBody();
        const toEmail = extractTargetEmail(message.getTo(), body);
        const fromEmail = message.getFrom();
        const codeType = identifyCodeType(subject, body);
        const extractedCode = extractCodeFromContent(subject, body, fromEmail, htmlBody, codeType);
        
        if (extractedCode && toEmail) {
          Logger.log(`Código detectado: ${extractedCode} para ${toEmail} (${codeType})`);
          
          const success = sendCodeToWebhook({
            account_email: toEmail,
            extracted_code: extractedCode,
            request_type: codeType,
            raw_email_subject: subject,
            raw_email_body: body.substring(0, 4000) // Hasta 4000 caracteres para evitar links truncados
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
  if (text.includes("restablecer") || text.includes("reset") || text.includes("contraseña") || text.includes("password")) {
    return "reset_password";
  }
  if (text.includes("hogar") || text.includes("household") || text.includes("temporal") || text.includes("viaje")) {
    return "household_update";
  }
  if (text.includes("iniciar sesión") || text.includes("sign-in") || text.includes("acceso")) {
    return "access_code";
  }
  return "verification";
}

/**
 * Expresiones regulares para extraer códigos de 4, 6 u 8 dígitos o enlaces temporales
 */
function extractCodeFromContent(subject, body, from, htmlBody, codeType) {
  const fullText = subject + "\n" + body;
  const isLinkRequested = codeType === "reset_password" || codeType === "household_update";

  // 1. SI ES RESTABLECER CONTRASEÑA O ACTUALIZAR HOGAR, BUSCAR EL ENLACE PRIMERO
  if (isLinkRequested) {
    if (htmlBody) {
      // Buscar botón de acción directo en el HTML (incluye reset de contraseña y hogar de Netflix)
      const buttonLinkMatch = htmlBody.match(/<a[^>]+href=["'](https:\/\/[^"']*(?:password\?|account\/password|password\/|update-primary-location|update-household|travel\/verify|verify|confirm)[^"']*)["'][^>]*>/i) ||
                             htmlBody.match(/<a[^>]+href=["'](https:\/\/(?:www\.)?(?:netflix|disneyplus|max|primevideo)\.com\/[^\s"'>]+)["'][^>]*>[\s\S]*?(?:actualizar|hogar|restablecer|cambiar|confirmar|acceso|empezar|verificar|reset)[\s\S]*?<\/a>/i);
      
      if (buttonLinkMatch && buttonLinkMatch[1]) {
        return buttonLinkMatch[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
      }
    }

    // Buscar en el texto plano (limpiando saltos quoted-printable)
    const cleanBody = (body || "").replace(/=\r?\n/g, "");
    const textLink = cleanBody.match(/(https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:password\?|account\/password|password\/|update-household|account\/travel\/verify|verify|confirm)[^\s"'<>]+)/i) ||
                     cleanBody.match(/(https:\/\/[^\s"'<>]+(?:password\?|account\/password|password\/|update-primary-location|update-household|verify|confirm)[^\s"'<>]*)/i);
    if (textLink && textLink[1]) {
      return textLink[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
    }
  }

  // 2. Si no es enlace o no se halló, buscar dígitos numéricos (4 a 8 dígitos)
  const digitMatches = fullText.match(/(?:código|code|pin|clave|acceso|verificación)[\s\:\-]+([0-9]{4,8})/i) ||
                       fullText.match(/([0-9]{4,8})[\s]+(?:es tu código|is your code)/i) ||
                       fullText.match(/\b([0-9]{4,6})\b/);

  if (digitMatches && digitMatches[1]) {
    return digitMatches[1].trim();
  }

  // 3. Respaldo general de enlaces si no se encontraron dígitos
  const urlMatch = fullText.match(/(https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:password\?|account\/travel\/verify|update-household)[^\s\>\"]+)/i) ||
                   fullText.match(/(https:\/\/(?:www\.)?disneyplus\.com\/[^\s\>\"]+)/i);

  if (urlMatch && urlMatch[1]) {
    return urlMatch[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
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
