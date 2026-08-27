import CodePortalClient from "@/components/CodePortalClient";
import { Lock } from "lucide-react";

export default function ClavePage() {
  return (
    <CodePortalClient
      actionType="reset_password"
      title="Restablecer Contraseña"
      badge="Password Reset"
      description="Ingresa el correo para recibir el enlace seguro de cambio de contraseña de la cuenta."
      icon={<Lock className="w-4 h-4 text-rose-400" />}
      themeColor="rose"
      buttonGradient="from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500"
    />
  );
}
