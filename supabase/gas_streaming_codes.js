/**
 * GOOGLE APPS SCRIPT - STREAMHUB / HOGARPRO
 * Búsqueda bajo demanda de Códigos Numéricos y Enlaces de Confirmación
 * (Actualizar Hogar, Restablecer Contraseña, Códigos Temporales)
 */

const CONFIG = {
  BASE_URL: "https://hogarpro-xrhd.vercel.app",
  API_SECRET: "token_ultra_secreto_para_proteger_endpoint_de_codigos_2026"
};

const SERVICE_DOMAINS = {
  netflix: "from:account.netflix.com OR from:netflix.com",
  disney: "from:disneyplus.com OR from:disney.com",
  max: "from:max.com OR from:hbomax.com",
  prime: "from:primevideo.com OR from:amazon.com",
  spotify: "from:spotify.com",
  crunchyroll: "from:crunchyroll.com",
  all: "from:account.netflix.com OR from:netflix.com OR from:disneyplus.com OR from:hbomax.com OR from:max.com OR from:primevideo.com OR from:spotify.com"
};

function doGet(e) {
  const email = (e && e.parameter && e.parameter.email) ? e.parameter.email.trim().toLowerCase() : "";
  const service = (e && e.parameter && e.parameter.service) ? e.parameter.service.trim().toLowerCase() : "all";

  if (!email) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "email requerido" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const result = buscarCodigoParaCorreo(email, service);
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  return doGet(e);
}

function buscarCodigoParaCorreo(targetEmail, serviceKey) {
  const domainFilter = SERVICE_DOMAINS[serviceKey] || SERVICE_DOMAINS.all;
  
  // Busca en Gmail: dirigido a este correo o que lo contenga
  const query = `(${domainFilter}) "${targetEmail}"`;
  Logger.log("Buscando en Gmail: " + query);
  
  let threads = GmailApp.search(query, 0, 5);
  if (threads.length === 0) {
    threads = GmailApp.search(`to:${targetEmail}`, 0, 5);
  }

  if (threads.length === 0) {
    return { success: false, message: "No se encontraron correos para " + targetEmail };
  }

  return procesarHilos(threads, targetEmail);
}

function procesarHilos(threads, targetEmail) {
  for (let i = 0; i < threads.length; i++) {
    const messages = threads[i].getMessages();
    for (let j = messages.length - 1; j >= 0; j--) {
      const message = messages[j];
      const subject = message.getSubject();
      const body = message.getPlainBody();
      const htmlBody = message.getBody();
      
      const codeOrLink = extraerCodigoOEnlace(subject, body, htmlBody);
      const actionType = detectarTipoAccion(subject, body);

      if (codeOrLink) {
        Logger.log(`[ENCONTRADO] ${targetEmail} -> ${codeOrLink}`);
        enviarAlServidor(targetEmail, codeOrLink, actionType, subject, body);
        return { 
          success: true, 
          code: codeOrLink, 
          email: targetEmail,
          actionType: actionType,
          isLink: codeOrLink.startsWith("http://") || codeOrLink.startsWith("https://")
        };
      }
    }
  }

  return { success: false, message: "Correos encontrados pero no se detectó código ni enlace aún" };
}

/**
 * Extrae código numérico O el enlace directo del botón en el correo
 */
function extraerCodigoOEnlace(subject, body, htmlBody) {
  const fullText = subject + "\n" + body;

  // 1. Dígitos espaciados de Netflix: "3 5 9 7"
  const spaced = fullText.match(/\b([0-9]\s+[0-9]\s+[0-9]\s+[0-9](?:\s+[0-9])?(?:\s+[0-9])?)\b/);
  if (spaced && spaced[1]) {
    const clean = spaced[1].replace(/\s+/g, "");
    if (clean.length >= 4 && clean.length <= 8) return clean;
  }

  // 2. Dígitos continuos (4 a 8 dígitos)
  const continuous = fullText.match(/(?:código|code|pin|clave)[\s\:\-]+([0-9]{4,8})/i) ||
                     fullText.match(/([0-9]{4,8})[\s]+(?:es tu código|is your code)/i) ||
                     fullText.match(/\b([0-9]{4,6})\b/);
  if (continuous && continuous[1]) {
    return continuous[1].trim();
  }

  // 3. Si no hay dígitos numéricos, buscar el enlace de acción (Actualizar Hogar, Restablecer, Confirmar)
  if (htmlBody) {
    // Buscar enlace dentro de botones o textos de confirmación (evitando URL_LOGO o footer)
    const buttonLinkMatch = htmlBody.match(/<a[^>]+href=["'](https:\/\/[^"']*(?:update-primary-location|account\/update|password|reset|travel|verify|confirm)[^"']*)["'][^>]*>/i) ||
                           htmlBody.match(/<a[^>]+href=["'](https:\/\/(?:www\.)?(?:netflix|disneyplus|max|primevideo)\.com\/[^\s"'>]+)["'][^>]*>[\s\S]*?(?:actualizar|hogar|restablecer|cambiar|confirmar|acceso|empezar|verificar)[\s\S]*?<\/a>/i);
    
    if (buttonLinkMatch && buttonLinkMatch[1]) {
      return buttonLinkMatch[1].replace(/&amp;/g, "&").trim();
    }
  }

  // 4. Enlace directo en texto plano
  const textLink = body.match(/(https:\/\/[^\s"'<>]+(?:update-primary-location|account\/update|password\/reset|verify|confirm)[^\s"'<>]*)/i);
  if (textLink && textLink[1]) {
    return textLink[1].replace(/&amp;/g, "&").trim();
  }

  return null;
}

function detectarTipoAccion(subject, body) {
  const text = (subject + " " + body).toLowerCase();
  if (text.includes("restablecer") || text.includes("reset password") || text.includes("contraseña")) {
    return "reset_password";
  }
  if (text.includes("actualizar hogar") || text.includes("update household") || text.includes("red principal") || text.includes("hogar con netflix")) {
    return "actualizar";
  }
  if (text.includes("temporal") || text.includes("viaje") || text.includes("travel") || text.includes("fuera de casa")) {
    return "temporal";
  }
  return "login_code";
}

function enviarAlServidor(email, codeOrLink, actionType, subject, body) {
  const endpoint = actionType === "actualizar" ? "/api/codes/actualizar"
                 : actionType === "reset_password" ? "/api/codes/reset-password"
                 : "/api/codes/temporal";

  const targetUrl = CONFIG.BASE_URL + endpoint;
  const payload = {
    account_email: email,
    extracted_code: codeOrLink,
    action_type: actionType,
    raw_subject: subject,
    raw_body: body ? body.substring(0, 300) : ""
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
    Logger.log("Error enviando al servidor: " + e.message);
  }
}
