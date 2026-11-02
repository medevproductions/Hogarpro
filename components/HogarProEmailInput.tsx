"use client";

import React, { useState, useEffect } from "react";
import { Mail } from "lucide-react";

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
  const extractPrefix = (val: string): string => {
    if (!val) return "";
    let clean = val.trim().toLowerCase();
    if (clean.includes("@")) {
      clean = clean.split("@")[0];
    }
    return clean.replace(/[^a-z0-9._-]/g, "");
  };

  const [prefix, setPrefix] = useState<string>(() => extractPrefix(value));

  useEffect(() => {
    setPrefix(extractPrefix(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.toLowerCase().trim();
    const cleanPrefix = rawVal.includes("@") ? rawVal.split("@")[0] : rawVal;
    const sanitized = cleanPrefix.replace(/[^a-z0-9._-]/g, "");
    setPrefix(sanitized);

    const fullEmail = sanitized ? `${sanitized}@hogarpro.com` : "";
    onChange(fullEmail);
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />

      <input
        id={id}
        type="text"
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={prefix}
        onChange={handleChange}
        className="w-full bg-[#0E121B] border border-slate-800 rounded-xl pl-10 pr-32 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition font-sans"
      />

      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs font-mono select-none pointer-events-none">
        <span>@hogarpro.com</span>
      </div>
    </div>
  );
}
