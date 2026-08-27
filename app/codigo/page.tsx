import CodePortalClient from "@/components/CodePortalClient";
import { Zap } from "lucide-react";

export default function CodigoPage() {
  return (
    <CodePortalClient
      actionType="login_code"
      title="Código de Inicio de Sesión"
      badge="OTP Rápido"
      description="Ingresa el correo para recibir el código de 6 u 8 dígitos de inicio de sesión."
      icon={<Zap className="w-4 h-4 text-emerald-400" />}
      themeColor="emerald"
      buttonGradient="from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
    />
  );
}
