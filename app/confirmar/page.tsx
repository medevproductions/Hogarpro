import CodePortalClient from "@/components/CodePortalClient";
import { ShieldCheck } from "lucide-react";

export default function ConfirmarPage() {
  return (
    <CodePortalClient
      actionType="login_confirm"
      title="Confirmar Inicio de Sesión"
      badge="Aceptar Acceso"
      description="Ingresa el correo para recibir el enlace de aprobación de acceso y validar el inicio de sesión."
      icon={<ShieldCheck className="w-4 h-4 text-purple-400" />}
      themeColor="purple"
      buttonGradient="from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
    />
  );
}
