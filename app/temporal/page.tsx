import CodePortalClient from "@/components/CodePortalClient";
import { Clock } from "lucide-react";

export default function TemporalPage() {
  return (
    <CodePortalClient
      actionType="temporal"
      title="Código Temporal / Hogar"
      badge="TV Fuera de Casa"
      description="Ingresa el correo de tu cuenta de Netflix o streaming para recibir el código de 4 dígitos para tu televisor."
      icon={<Clock className="w-4 h-4 text-amber-400" />}
      themeColor="amber"
      buttonGradient="from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500"
    />
  );
}
