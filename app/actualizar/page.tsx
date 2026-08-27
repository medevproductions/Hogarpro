import CodePortalClient from "@/components/CodePortalClient";
import { Home } from "lucide-react";

export default function ActualizarPage() {
  return (
    <CodePortalClient
      actionType="actualizar"
      title="Actualizar Hogar Principal"
      badge="Red Doméstica"
      description="Ingresa el correo para actualizar la red del hogar principal y generar el enlace de confirmación."
      icon={<Home className="w-4 h-4 text-blue-400" />}
      themeColor="blue"
      buttonGradient="from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500"
    />
  );
}
