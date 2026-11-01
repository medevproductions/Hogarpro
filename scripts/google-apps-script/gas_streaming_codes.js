/**
 * GOOGLE APPS SCRIPT (GAS) - STREAMHUB / HOGARPRO
 * EXCLUSIVO NETFLIX - EXTRACTOR ESPECIALIZADO DE 5 ACCIONES
 * 
 * 1. Codigo de inicio de sesion (4 dígitos numéricos para TV / pantalla)
 * 2. Codigo de verificacion (6 dígitos numéricos - OTP de verificación)
 * 3. Solicitar actualizar hogar netflix (link oficial directo HTTPS)
 * 4. Codigo de acceso temporal (link oficial de viaje / fuera de casa HTTPS)
 * 5. Reestablecer contraseña (link oficial directo para cambiar clave HTTPS)
 * 
 * NOTA IMPORTANTE:
 * - Solo 'login_code' y 'verification_code' son números.
 * - 'actualizar_hogar', 'acceso_temporal' y 'reset_password' son enlaces (links).
 * 
 * Instrucciones:
 * 1. Pega este código completo en tu proyecto de Google Apps Script (Editor de código).
 * 2. Haz clic en "Implementar" > "Nueva implementación" > Tipo: "Aplicación web".
 * 3. Ejecutar como: "Yo" (tu cuenta de Google donde llegan los correos de Netflix).
 * 4. Quién tiene acceso: "Cualquiera" (para que el backend de HogarPro pueda consultar).
 * 5. Haz clic en "Implementar" y confirma permisos si los solicita.
 */

const CONFIG = {
  BASE_URL: "https://hogarpro-xrhd.vercel.app",
  API_SECRET: (typeof PropertiesService !== "undefined" && PropertiesService.getScriptProperties().getProperty("API_SECRET")) || "token_ultra_secreto_para_proteger_endpoint_de_codigos_2026",
  NETFLIX_FROM: "from:netflix.com OR from:account.netflix.com OR from:mailer.netflix.com"
};

/**
 * Punto de entrada HTTP GET para el backend de Next.js (/api/codes/check)
 */
function doGet(e) {
  try {
    const email = (e && e.parameter && e.parameter.email) ? e.parameter.email.trim().toLowerCase() : "";
    const rawActionType = (e && e.parameter && e.parameter.actionType) ? e.parameter.actionType.trim().toLowerCase() : "login_code";

    if (!email) {
      return ContentService.createTextOutput(JSON.stringify({ 
        success: false, 
        error: "Parámetro 'email' es requerido" 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const result = buscarCodigoNetflix(email, rawActionType);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: "Error interno en Google Apps Script: " + err.message 
    })).setMimeType(ContentService.MimeType.JSON);
  }
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
  if (a === "auto" || a === "any" || a === "detect" || a === "all") return "auto";
  if (a === "actualizar" || a === "actualizar_hogar" || a === "hogar" || a === "household") return "actualizar_hogar";
  if (a === "temporal" || a === "acceso_temporal" || a === "viaje" || a === "travel") return "acceso_temporal";
  if (a === "login_confirm" || a === "verification_code" || a === "verificacion" || a === "verification" || a === "otp") return "verification_code";
  if (a === "reset_password" || a === "clave" || a === "password" || a === "restablecer" || a === "reset") return "reset_password";
  if (a === "login_code" || a === "login" || a === "inicio" || a === "signin") return "login_code";
  return a;
}

/**
 * Genera palabras clave para priorizar la búsqueda en Gmail según la acción
 */
function obtenerQueryKeywords(action) {
  switch (action) {
    case "login_code":
      return '(subject:"iniciar sesión" OR subject:"iniciar sesion" OR subject:"sign-in" OR subject:"código" OR subject:"codigo" OR subject:"login")';
    case "verification_code":
      return '(subject:"código de verificación" OR subject:"codigo de verificacion" OR subject:"verificación" OR subject:"verification" OR subject:"código" OR subject:"codigo")';
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
  const isNumberAction = (action === "login_code" || action === "verification_code");
  const keywords = obtenerQueryKeywords(action);

  // Manejo de alias con '+' (Plus-Addressing ej: hogaryutu+acido@gmail.com)
  const baseEmail = cleanTarget.includes("+") 
    ? (cleanTarget.split("+")[0] + "@" + cleanTarget.split("@")[1]) 
    : cleanTarget;

  let threads = [];

  // Intento 1: Búsqueda exacta del correo con comillas + remitente Netflix (compatible con embudos)
  try {
    const urlEncoded = cleanTarget.replace("@", "%40");
    const q1 = `("${cleanTarget}" OR to:"${cleanTarget}" OR "${urlEncoded}") (${CONFIG.NETFLIX_FROM})`.trim();
    Logger.log("Búsqueda 1: " + q1);
    threads = GmailApp.search(q1, 0, 10);
  } catch (e1) {
    Logger.log("Error búsqueda 1: " + e1.message);
  }

  // Intento 2: Si tiene '+' y no encontró nada, buscar en la casilla base
  if ((!threads || threads.length === 0) && cleanTarget.includes("+")) {
    try {
      const q2 = `to:"${baseEmail}" (${CONFIG.NETFLIX_FROM}) ${keywords}`.trim();
      Logger.log("Búsqueda 2 (base email): " + q2);
      threads = GmailApp.search(q2, 0, 10);
    } catch (e2) {
      Logger.log("Error búsqueda 2: " + e2.message);
    }
  }

  // Intento 3: Búsqueda general de Netflix con keywords de la acción
  if (!threads || threads.length === 0) {
    try {
      const q3 = `(${CONFIG.NETFLIX_FROM}) ${keywords}`.trim();
      Logger.log("Búsqueda 3 (general con keywords): " + q3);
      threads = GmailApp.search(q3, 0, 10);
    } catch (e3) {
      Logger.log("Error búsqueda 3: " + e3.message);
    }
  }

  // Intento 4: Todos los correos recientes de Netflix
  if (!threads || threads.length === 0) {
    try {
      const q4 = `(${CONFIG.NETFLIX_FROM})`.trim();
      Logger.log("Búsqueda 4 (últimos correos Netflix): " + q4);
      threads = GmailApp.search(q4, 0, 10);
    } catch (e4) {
      Logger.log("Error búsqueda 4: " + e4.message);
    }
  }

  if (!threads || threads.length === 0) {
    return { 
      success: false, 
      message: "No se encontraron correos de Netflix en la bandeja para " + cleanTarget + ". Asegúrate de haber solicitado el código desde Netflix.",
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
  const isNumberCode = (requestedAction === "login_code" || requestedAction === "verification_code");
  
  // Para enlaces: hasta 48 horas de vigencia. Para números: hasta 4 horas
  const MAX_AGE_MS = isNumberCode ? (4 * 60 * 60 * 1000) : (48 * 60 * 60 * 1000);

  const cleanTarget = targetEmail.trim().toLowerCase();
  const baseEmail = cleanTarget.includes("+") 
    ? (cleanTarget.split("+")[0] + "@" + cleanTarget.split("@")[1]) 
    : cleanTarget;

  // PASADA 1: Búsqueda en mensajes recientes
  for (let i = 0; i < allMessages.length; i++) {
    const message = allMessages[i];
    const msgDate = message.getDate().getTime();

    // Descartar mensajes fuera de la ventana de tiempo
    if (now - msgDate > MAX_AGE_MS) {
      continue;
    }

    const rawTo = (message.getTo() || "").toLowerCase();
    const body = message.getPlainBody() || "";
    const htmlBody = message.getBody() || "";
    const subject = message.getSubject() || "";

    // Validación de destinatario flexible (especial para embudos de reenvío multicuenta):
    // Verifica To, cuerpo, HTML, enlaces codificados o cabeceras raw del reenvío
    const urlEncodedTarget = cleanTarget.replace("@", "%40");
    let matchesTarget = rawTo.includes(cleanTarget) || 
                        body.toLowerCase().includes(cleanTarget) || 
                        htmlBody.toLowerCase().includes(cleanTarget) ||
                        htmlBody.toLowerCase().includes(urlEncodedTarget) ||
                        (baseEmail && rawTo.includes(baseEmail)) ||
                        (threads.length === 1);

    if (!matchesTarget) {
      try {
        const rawContent = message.getRawContent ? message.getRawContent().toLowerCase() : "";
        if (rawContent && (rawContent.includes(cleanTarget) || rawContent.includes(urlEncodedTarget))) {
          matchesTarget = true;
        }
      } catch (err) {}
    }

    if (!matchesTarget) {
      continue;
    }

    const codeOrLink = extraerPorAccionNetflix(subject, body, htmlBody, requestedAction);
    if (codeOrLink) {
      const finalCode = (typeof codeOrLink === "object" && codeOrLink.code) ? codeOrLink.code : codeOrLink;
      const finalAction = (typeof codeOrLink === "object" && codeOrLink.action) ? codeOrLink.action : requestedAction;
      const finalIsLink = (typeof codeOrLink === "object" && typeof codeOrLink.isLink === "boolean") ? codeOrLink.isLink : !isNumberCode;

      Logger.log(`[NETFLIX EXITO] ${cleanTarget} | Acción: ${finalAction} -> ${finalCode}`);
      enviarAlServidor(cleanTarget, finalCode, finalAction, subject, body || htmlBody);
      return {
        success: true,
        code: finalCode,
        email: cleanTarget,
        actionType: finalAction,
        isLink: finalIsLink,
        receivedAt: new Date(msgDate).toISOString()
      };
    }
  }

  // PASADA 2 (FALLBACK): Si no se encontró dentro de la ventana de tiempo, tomar el mensaje más reciente del hilo
  for (let i = 0; i < allMessages.length; i++) {
    const message = allMessages[i];
    const body = message.getPlainBody() || "";
    const htmlBody = message.getBody() || "";
    const subject = message.getSubject() || "";
    const msgDate = message.getDate().getTime();

    const codeOrLink = extraerPorAccionNetflix(subject, body, htmlBody, requestedAction);
    if (codeOrLink) {
      const finalCode = (typeof codeOrLink === "object" && codeOrLink.code) ? codeOrLink.code : codeOrLink;
      const finalAction = (typeof codeOrLink === "object" && codeOrLink.action) ? codeOrLink.action : requestedAction;
      const finalIsLink = (typeof codeOrLink === "object" && typeof codeOrLink.isLink === "boolean") ? codeOrLink.isLink : !isNumberCode;

      Logger.log(`[NETFLIX FALLBACK EXITO] ${cleanTarget} | Acción: ${finalAction} -> ${finalCode}`);
      enviarAlServidor(cleanTarget, finalCode, finalAction, subject, body || htmlBody);
      return {
        success: true,
        code: finalCode,
        email: cleanTarget,
        actionType: finalAction,
        isLink: finalIsLink,
        receivedAt: new Date(msgDate).toISOString(),
        note: "Extraído del correo más reciente disponible"
      };
    }
  }

  return { 
    success: false, 
    message: isNumberCode
      ? "No se encontró ningún código numérico reciente para " + cleanTarget + ". Solicita el código en la pantalla de Netflix e inténtalo de nuevo."
      : "No se encontró ningún enlace reciente para " + cleanTarget + ". Solicita la confirmación en Netflix e inténtalo de nuevo.",
    actionType: requestedAction 
  };
}

/**
 * Extrae con exactitud el código o enlace según la acción requerida de Netflix
 * - login_code y verification_code -> EXCLUSIVAMENTE NÚMEROS
 * - actualizar_hogar, acceso_temporal y reset_password -> EXCLUSIVAMENTE ENLACES (LINKS)
 */
function extraerPorAccionNetflix(subject, body, htmlBody, actionType) {
  const normAction = normalizarAccion(actionType);

  // MODO DETECCIÓN AUTOMÁTICA
  if (normAction === "auto") {
    const linkHogar = extraerLinkNetflix(subject, body, htmlBody, "actualizar_hogar");
    if (linkHogar) return { code: linkHogar, action: "actualizar_hogar", isLink: true };

    const linkViaje = extraerLinkNetflix(subject, body, htmlBody, "acceso_temporal");
    if (linkViaje) return { code: linkViaje, action: "acceso_temporal", isLink: true };

    const linkReset = extraerLinkNetflix(subject, body, htmlBody, "reset_password");
    if (linkReset) return { code: linkReset, action: "reset_password", isLink: true };

    const code6 = extraerCodigoVerificacion6Digitos(subject, body, htmlBody);
    if (code6) return { code: code6, action: "verification_code", isLink: false };

    const code4 = extraerCodigoInicioSesion4Digitos(subject, body, htmlBody);
    if (code4) return { code: code4, action: "login_code", isLink: false };

    return null;
  }

  if (normAction === "login_code") {
    // 1. Código de Inicio de Sesión: ESTRICTAMENTE 4 DÍGITOS (para TV o pantalla)
    return extraerCodigoInicioSesion4Digitos(subject, body, htmlBody);
  } else if (normAction === "verification_code") {
    // 2. Código de Verificación: ESTRICTAMENTE 6 DÍGITOS (OTP numérico)
    return extraerCodigoVerificacion6Digitos(subject, body, htmlBody);
  } else {
    // 3, 4 y 5: Son ENLACES OFICIALES (LINKS)
    return extraerLinkNetflix(subject, body, htmlBody, normAction);
  }
}

/**
 * EXTRACTOR ESTRICTO DE CÓDIGO DE INICIO DE SESIÓN (EXACTAMENTE 4 DÍGITOS)
 * Diseñado específicamente para TV, pantalla o login de Netflix
 */
function extraerCodigoInicioSesion4Digitos(subject, body, htmlBody) {
  const cleanBody = (body || "").replace(/=\r?\n/g, "");
  const cleanHtml = (htmlBody || "").replace(/=\r?\n/g, "");
  const combined = (subject || "") + "\n" + cleanBody;

  // 1. Dígitos espaciados en HTML o texto (ej: "8 4 9 2")
  const spacedHtml = cleanHtml.match(/>\s*([0-9]\s+[0-9]\s+[0-9]\s+[0-9])\s*</);
  if (spacedHtml && spacedHtml[1]) {
    const code = spacedHtml[1].replace(/\s+/g, "");
    if (code.length === 4 && !esAnio(code)) return code;
  }

  const spacedText = combined.match(/\b([0-9]\s+[0-9]\s+[0-9]\s+[0-9])\b/);
  if (spacedText && spacedText[1]) {
    const code = spacedText[1].replace(/\s+/g, "");
    if (code.length === 4 && !esAnio(code)) return code;
  }

  // 2. Elemento HTML con tamaño de fuente grande o contenedor de código
  const bigFontMatch = cleanHtml.match(/font-size:\s*(?:2[4-9]|[3-9][0-9])px[^>]*>\s*([0-9\s]{4,6})\s*</i) ||
                       cleanHtml.match(/letter-spacing:\s*[^>]*>\s*([0-9\s]{4,6})\s*</i) ||
                       cleanHtml.match(/class=["'][^"']*(?:code|pin|otp|token)[^"']*["'][^>]*>\s*([0-9\s]{4,6})\s*</i);
  if (bigFontMatch && bigFontMatch[1]) {
    const code = bigFontMatch[1].replace(/\s+/g, "");
    if (code.length === 4 && !esAnio(code)) return code;
  }

  // 3. Dígitos en exactamente 4 celdas de tabla <td>8</td><td>4</td>...
  const cellRegex = /<td[^>]*>\s*([0-9])\s*<\/td>/gi;
  let cellMatch;
  const digits = [];
  while ((cellMatch = cellRegex.exec(cleanHtml)) !== null) {
    digits.push(cellMatch[1]);
    if (digits.length === 4) break;
  }
  if (digits.length === 4 && !esAnio(digits.join(""))) {
    return digits.join("");
  }

  // 4. Código precedido por texto clave ("iniciar sesión: 8492", "código para iniciar: 8492", "código es: 8492")
  const prefixedMatch = combined.match(/(?:iniciar\s+sesión|iniciar|sign-in|código|code|pin|clave|acceso)[\s\:\-]+([0-9]{4})\b/i) ||
                        combined.match(/\b([0-9]{4})\b[\s]+(?:es tu código|is your code|para iniciar|for sign-in)/i);
  if (prefixedMatch && prefixedMatch[1]) {
    const code = prefixedMatch[1].trim();
    if (!esAnio(code)) return code;
  }

  // 5. Código presente en el asunto del correo (ej: "8492 es tu código para iniciar sesión")
  const subjectMatch = (subject || "").match(/\b([0-9]{4})\b/);
  if (subjectMatch && subjectMatch[1]) {
    const code = subjectMatch[1].trim();
    if (!esAnio(code)) return code;
  }

  // 6. Secuencia aislada de exactamente 4 dígitos en el cuerpo (evitando años 2020-2030)
  const allMatches = cleanBody.match(/\b([0-9]{4})\b/g);
  if (allMatches) {
    for (let k = 0; k < allMatches.length; k++) {
      const cand = allMatches[k];
      if (cand.length === 4 && !esAnio(cand) && !cand.startsWith("19") && !cand.startsWith("202")) {
        return cand;
      }
    }
  }

  return null;
}

/**
 * EXTRACTOR ESTRICTO DE CÓDIGO DE VERIFICACIÓN (EXACTAMENTE 6 DÍGITOS)
 * Código OTP numérico de verificación de Netflix
 */
function extraerCodigoVerificacion6Digitos(subject, body, htmlBody) {
  const cleanBody = (body || "").replace(/=\r?\n/g, "");
  const cleanHtml = (htmlBody || "").replace(/=\r?\n/g, "");
  const combined = (subject || "") + "\n" + cleanBody;

  // 1. Dígitos espaciados en HTML o texto (ej: "1 2 3 4 5 6")
  const spacedHtml = cleanHtml.match(/>\s*([0-9]\s+[0-9]\s+[0-9]\s+[0-9]\s+[0-9]\s+[0-9])\s*</);
  if (spacedHtml && spacedHtml[1]) {
    const code = spacedHtml[1].replace(/\s+/g, "");
    if (code.length === 6) return code;
  }

  const spacedText = combined.match(/\b([0-9]\s+[0-9]\s+[0-9]\s+[0-9]\s+[0-9]\s+[0-9])\b/);
  if (spacedText && spacedText[1]) {
    const code = spacedText[1].replace(/\s+/g, "");
    if (code.length === 6) return code;
  }

  // 2. Elemento HTML con tamaño de fuente grande o contenedor de código OTP
  const bigFontMatch = cleanHtml.match(/font-size:\s*(?:2[4-9]|[3-9][0-9])px[^>]*>\s*([0-9\s]{6,8})\s*</i) ||
                       cleanHtml.match(/letter-spacing:\s*[^>]*>\s*([0-9\s]{6,8})\s*</i) ||
                       cleanHtml.match(/class=["'][^"']*(?:code|pin|otp|token|verification)[^"']*["'][^>]*>\s*([0-9\s]{6,8})\s*</i);
  if (bigFontMatch && bigFontMatch[1]) {
    const code = bigFontMatch[1].replace(/\s+/g, "");
    if (code.length === 6) return code;
  }

  // 3. Dígitos en exactamente 6 celdas de tabla <td>1</td><td>2</td>...
  const cellRegex = /<td[^>]*>\s*([0-9])\s*<\/td>/gi;
  let cellMatch;
  const digits = [];
  while ((cellMatch = cellRegex.exec(cleanHtml)) !== null) {
    digits.push(cellMatch[1]);
    if (digits.length === 6) break;
  }
  if (digits.length === 6) {
    return digits.join("");
  }

  // 4. Código precedido por texto clave de verificación ("código de verificación: 123456", "código es: 123456")
  const prefixedMatch = combined.match(/(?:verificación|verification|un\s+solo\s+uso|otp|código|code|clave)[\s\:\-]+([0-9]{6})\b/i) ||
                        combined.match(/\b([0-9]{6})\b[\s]+(?:es tu código|is your verification code|para verificar)/i);
  if (prefixedMatch && prefixedMatch[1]) {
    return prefixedMatch[1].trim();
  }

  // 5. Código de 6 dígitos en el asunto del correo (ej: "123456 es tu código de verificación")
  const subjectMatch = (subject || "").match(/\b([0-9]{6})\b/);
  if (subjectMatch && subjectMatch[1]) {
    return subjectMatch[1].trim();
  }

  // 6. Secuencia aislada de exactamente 6 dígitos en el cuerpo
  const allMatches = cleanBody.match(/\b([0-9]{6})\b/g);
  if (allMatches) {
    for (let k = 0; k < allMatches.length; k++) {
      const cand = allMatches[k];
      if (cand.length === 6) {
        return cand;
      }
    }
  }

  return null;
}

function esAnio(val) {
  const num = parseInt(val, 10);
  return num >= 2020 && num <= 2030;
}

/**
 * EXTRACTOR DE ENLACES OFICIALES (LINKS)
 * Diseñado específicamente para Hogar, Acceso Temporal y Restablecer Contraseña
 */
function extraerLinkNetflix(subject, body, htmlBody, action) {
  const cleanHtml = (htmlBody || "").replace(/=\r?\n/g, "");
  const cleanBody = (body || "").replace(/=\r?\n/g, "");

  // 1. ACTUALIZAR HOGAR NETFLIX (LINK)
  if (action === "actualizar_hogar") {
    // Buscar en HTML botón específico
    const btn = cleanHtml.match(/href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:update-household|account\/update-household|email\/click|nmtr)[^"']*)["'][^>]*>[\s\S]*?(?:actualizar|hogar|sí|si|solicité|household|confirmar)[\s\S]*?<\/a>/i) ||
                cleanHtml.match(/href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:update-household|account\/update-household)[^"']*)["']/i);
    if (btn && btn[1]) return limpiarUrl(btn[1]);

    const textLink = cleanBody.match(/(https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:update-household|account\/update-household)[^\s"'<>]+)/i);
    if (textLink && textLink[1]) return limpiarUrl(textLink[1]);

    // Enlace genérico de confirmación en correo de hogar
    const anyNfLink = cleanHtml.match(/href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/[^\s"'>]+)["']/i);
    if (anyNfLink && anyNfLink[1] && anyNfLink[1].length > 30) return limpiarUrl(anyNfLink[1]);
  }

  // 2. ACCESO TEMPORAL / VIAJE (LINK)
  if (action === "acceso_temporal") {
    const btn = cleanHtml.match(/href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:account\/travel\/verify|travel\/verify|verify-travel|account\/travel|email\/click|nmtr)[^"']*)["'][^>]*>[\s\S]*?(?:obtener|enviar|código|codigo|viaje|temporal|acceso|confirmar|travel|continuar)[\s\S]*?<\/a>/i) ||
                cleanHtml.match(/href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:account\/travel\/verify|travel\/verify|verify-travel|account\/travel)[^"']*)["']/i);
    if (btn && btn[1]) return limpiarUrl(btn[1]);

    const textLink = cleanBody.match(/(https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:account\/travel\/verify|travel\/verify|verify-travel|account\/travel)[^\s"'<>]+)/i);
    if (textLink && textLink[1]) return limpiarUrl(textLink[1]);

    const anyNfLink = cleanHtml.match(/href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/[^\s"'>]+)["']/i);
    if (anyNfLink && anyNfLink[1] && anyNfLink[1].length > 30) return limpiarUrl(anyNfLink[1]);
  }

  // 3. RESTABLECER CONTRASEÑA (LINK)
  if (action === "reset_password") {
    const btn = cleanHtml.match(/href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:password\?|account\/password|password\/|email\/click|nmtr)[^"']*)["'][^>]*>[\s\S]*?(?:restablecer|cambiar|reset|password|contraseña)[\s\S]*?<\/a>/i) ||
                cleanHtml.match(/href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:password\?|account\/password|password\/)[^"']*)["']/i);
    if (btn && btn[1]) return limpiarUrl(btn[1]);

    const textLink = cleanBody.match(/(https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:password\?|account\/password|password\/)[^\s"'<>]+)/i);
    if (textLink && textLink[1]) return limpiarUrl(textLink[1]);

    const anyNfLink = cleanHtml.match(/href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/[^\s"'>]+)["']/i);
    if (anyNfLink && anyNfLink[1] && anyNfLink[1].length > 30) return limpiarUrl(anyNfLink[1]);
  }

  return null;
}

function limpiarUrl(url) {
  if (!url) return null;
  return url.replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
}

/**
 * Envía el código o enlace extraído al Webhook central de Next.js
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
