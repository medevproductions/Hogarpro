"use client";

import React, { useState, useEffect } from "react";
import { Mail, CheckCircle2 } from "lucide-react";

interface HogarProEmailInputProps {
  value: string;
  onChange: (fullEmail: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export default function HogarProEmailInput({
  value,
  onChange,
  placeholder = "usuario",
  required = false,
  className = "",
  disabled = false,
  id
}: HogarProEmailInputProps) {
  // Extraer el prefijo inicial limpiando cualquier @hogarpro.com o dominio previo
  const extractPrefix = (val: string): string => {
    if (!val) return "";
    let clean = val.trim().toLowerCase();
    if (clean.includes("@")) {
      clean = clean.split("@")[0];
    }
    // Permitir letras, números, puntos, guiones bajos y guiones
    return clean.replace(/[^a-z0-9._-]/g, "");
  };

  const [prefix, setPrefix] = useState<string>(() => extractPrefix(value));

  useEffect(() => {
    setPrefix(extractPrefix(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.toLowerCase().trim();
    const cleanPrefix = rawVal.includes("@") ? rawVal.split("@")[0] : rawVal;
    // Sanitizar caracteres no permitidos en la parte local del correo
    const sanitized = cleanPrefix.replace(/[^a-z0-9._-]/g, "");
    setPrefix(sanitized);

    const fullEmail = sanitized ? `${sanitized}@hogarpro.com` : "";
    onChange(fullEmail);
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Icono de correo a la izquierda */}
      <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />

      {/* Input de texto para el prefijo */}
      <input
        id={id}
        type="text"
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={prefix}
        onChange={handleChange}
        className="w-full bg-[#161616] border border-[#333333] rounded-xl pl-10 pr-32 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] transition font-mono"
      />

      {/* Badge fijo de @hogarpro.com a la derecha */}
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs font-mono font-bold select-none pointer-events-none">
        <span>@hogarpro.com</span>
      </div>
    </div>
  );
}
