/**
 * GOOGLE APPS SCRIPT - STREAMHUB / HOGARPRO
 * Búsqueda bajo demanda de Códigos Numéricos y Enlaces de Confirmación
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
  const actionType = (e && e.parameter && e.parameter.actionType) ? e.parameter.actionType.trim().toLowerCase() : "temporal";

  if (!email) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "email requerido" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const result = buscarCodigoParaCorreo(email, service, actionType);
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  return doGet(e);
}

function buscarCodigoParaCorreo(targetEmail, serviceKey, actionType) {
  const domainFilter = SERVICE_DOMAINS[serviceKey] || SERVICE_DOMAINS.all;
  
  // Busca en Gmail: dirigido a este correo o que lo contenga, priorizando las últimas 24 horas
  const query = `(${domainFilter}) "${targetEmail}" newer_than:1d`;
  Logger.log("Buscando en Gmail: " + query);
  
  let threads = GmailApp.search(query, 0, 5);
  if (threads.length === 0) {
    threads = GmailApp.search(`(${domainFilter}) "${targetEmail}"`, 0, 5);
  }
  if (threads.length === 0) {
    threads = GmailApp.search(`to:${targetEmail} newer_than:1d`, 0, 5);
  }

  if (threads.length === 0) {
    return { success: false, message: "No se encontraron correos para " + targetEmail };
  }

  // Asegurar que los hilos se ordenen por fecha del último mensaje
  threads.sort((a, b) => b.getLastMessageDate().getTime() - a.getLastMessageDate().getTime());

  return procesarHilos(threads, targetEmail, actionType);
}

function procesarHilos(threads, targetEmail, requestedActionType) {
  // Recopilar todos los mensajes y ordenarlos por fecha más reciente primero
  const allMessages = [];
  for (let i = 0; i < threads.length; i++) {
    const msgs = threads[i].getMessages();
    for (let j = 0; j < msgs.length; j++) {
      allMessages.push(msgs[j]);
    }
  }

  // Ordenar de más nuevo a más viejo
  allMessages.sort((a, b) => b.getDate().getTime() - a.getDate().getTime());

  for (let i = 0; i < allMessages.length; i++) {
    const message = allMessages[i];
    const subject = message.getSubject();
    const body = message.getPlainBody();
    const htmlBody = message.getBody();
    
    const detectedAction = detectarTipoAccion(subject, body);
    const actionType = requestedActionType || detectedAction;

    const codeOrLink = extraerCodigoOEnlace(subject, body, htmlBody, actionType);

    if (codeOrLink) {
      Logger.log(`[ENCONTRADO MÁS RECIENTE (${message.getDate()})] ${targetEmail} -> ${codeOrLink}`);
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

  return { success: false, message: "Correos encontrados pero no se detectó código ni enlace aún" };
}

/**
 * Extrae código numérico O el enlace directo del botón en el correo
 */
function extraerCodigoOEnlace(subject, body, htmlBody, actionType) {
  const fullText = subject + "\n" + body;

  // 1. SIEMPRE intentar buscar dígitos numéricos primero
  // Dígitos espaciados de Netflix: "3 5 9 7"
  const spaced = fullText.match(/\b([0-9]\s+[0-9]\s+[0-9]\s+[0-9](?:\s+[0-9])?(?:\s+[0-9])?)\b/);
  if (spaced && spaced[1]) {
    const clean = spaced[1].replace(/\s+/g, "");
    if (clean.length >= 4 && clean.length <= 8) return clean;
  }

  // Dígitos continuos (4 a 8 dígitos)
  const continuous = fullText.match(/(?:código|code|pin|clave)[\s\:\-]+([0-9]{4,8})/i) ||
                     fullText.match(/([0-9]{4,8})[\s]+(?:es tu código|is your code)/i) ||
                     fullText.match(/\b([0-9]{4,6})\b/);
  if (continuous && continuous[1]) {
    return continuous[1].trim();
  }

  // 2. SOLO si la acción solicitada es 'actualizar' o 'reset_password' se buscan enlaces
  if (actionType === "actualizar" || actionType === "reset_password") {
    if (htmlBody) {
      const buttonLinkMatch = htmlBody.match(/<a[^>]+href=["'](https:\/\/[^"']*(?:update-primary-location|account\/update|password|reset|travel|verify|confirm)[^"']*)["'][^>]*>/i) ||
                             htmlBody.match(/<a[^>]+href=["'](https:\/\/(?:www\.)?(?:netflix|disneyplus|max|primevideo)\.com\/[^\s"'>]+)["'][^>]*>[\s\S]*?(?:actualizar|hogar|restablecer|cambiar|confirmar|acceso|empezar|verificar)[\s\S]*?<\/a>/i);
      
      if (buttonLinkMatch && buttonLinkMatch[1]) {
        return buttonLinkMatch[1].replace(/&amp;/g, "&").trim();
      }
    }

    const textLink = body.match(/(https:\/\/[^\s"'<>]+(?:update-primary-location|account\/update|password\/reset|verify|confirm)[^\s"'<>]*)/i);
    if (textLink && textLink[1]) {
      return textLink[1].replace(/&amp;/g, "&").trim();
    }
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
