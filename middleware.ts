import { NextRequest, NextResponse } from "next/server";

interface SessionPayload {
  id: string;
  email: string;
  role: "owner" | "seller" | "admin";
  name?: string;
  exp: number;
}

function parseSessionCookie(req: NextRequest): SessionPayload | null {
  const cookie = req.cookies.get("hp_session")?.value;
  if (!cookie) return null;

  try {
    const jsonStr = decodeURIComponent(atob(cookie));
    const data: SessionPayload = JSON.parse(jsonStr);

    // Verificar expiración
    if (!data.exp || Date.now() > data.exp) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = parseSessionCookie(req);

  // 1. Proteger rutas de Owner / Administrador
  if (pathname.startsWith("/dashboard/owner")) {
    if (!session || (session.role !== "owner" && (session.role as string) !== "admin")) {
      const loginUrl = new URL("/admin", req.url);
      loginUrl.searchParams.set("error", "unauthorized");
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Proteger rutas del Portal de Vendedores
  if (pathname.startsWith("/dashboard/seller")) {
    if (!session) {
      const loginUrl = new URL("/", req.url);
      loginUrl.searchParams.set("error", "login_required");
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 3. Proteger rutas de consulta de códigos: Restringidas exclusivamente a Owner y Revendedores
  // Los clientes finales no tienen acceso a consultar códigos
  const isCodeLookupRoute = 
    pathname.startsWith("/soporte-codigos") || 
    pathname.startsWith("/streaming/soporte-codigos") ||
    pathname === "/codigo" ||
    pathname === "/actualizar" ||
    pathname === "/temporal" ||
    pathname === "/confirmar" ||
    pathname === "/clave";

  if (isCodeLookupRoute) {
    if (!session) {
      const loginUrl = new URL("/", req.url);
      loginUrl.searchParams.set("error", "restricted");
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/owner/:path*",
    "/dashboard/seller/:path*",
    "/soporte-codigos/:path*",
    "/streaming/soporte-codigos/:path*",
    "/codigo",
    "/actualizar",
    "/temporal",
    "/confirmar",
    "/clave"
  ]
};
