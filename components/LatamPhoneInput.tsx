"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Search } from "lucide-react";

export interface LatamCountry {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

export const LATAM_COUNTRIES: LatamCountry[] = [
  { code: "CO", name: "Colombia", dialCode: "+57", flag: "🇨🇴" },
  { code: "VE", name: "Venezuela", dialCode: "+58", flag: "🇻🇪" },
  { code: "MX", name: "México", dialCode: "+52", flag: "🇲🇽" },
  { code: "AR", name: "Argentina", dialCode: "+54", flag: "🇦🇷" },
  { code: "CL", name: "Chile", dialCode: "+56", flag: "🇨🇱" },
  { code: "PE", name: "Perú", dialCode: "+51", flag: "🇵🇪" },
  { code: "EC", name: "Ecuador", dialCode: "+593", flag: "🇪🇨" },
  { code: "PA", name: "Panamá", dialCode: "+507", flag: "🇵🇦" },
  { code: "CR", name: "Costa Rica", dialCode: "+506", flag: "🇨🇷" },
  { code: "DO", name: "República Dominicana", dialCode: "+1", flag: "🇩🇴" },
  { code: "GT", name: "Guatemala", dialCode: "+502", flag: "🇬🇹" },
  { code: "HN", name: "Honduras", dialCode: "+504", flag: "🇭🇳" },
  { code: "SV", name: "El Salvador", dialCode: "+503", flag: "🇸🇻" },
  { code: "NI", name: "Nicaragua", dialCode: "+505", flag: "🇳🇮" },
  { code: "BO", name: "Bolivia", dialCode: "+591", flag: "🇧🇴" },
  { code: "PY", name: "Paraguay", dialCode: "+595", flag: "🇵🇾" },
  { code: "UY", name: "Uruguay", dialCode: "+598", flag: "🇺🇾" },
  { code: "BR", name: "Brasil", dialCode: "+55", flag: "🇧🇷" },
  { code: "PR", name: "Puerto Rico", dialCode: "+1", flag: "🇵🇷" },
  { code: "CU", name: "Cuba", dialCode: "+53", flag: "🇨🇺" },
  { code: "ES", name: "España", dialCode: "+34", flag: "🇪🇸" },
  { code: "US", name: "Estados Unidos", dialCode: "+1", flag: "🇺🇸" }
];

interface LatamPhoneInputProps {
  value: string;
  onChange: (fullPhoneNumber: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export default function LatamPhoneInput({
  value,
  onChange,
  placeholder = "300 123 4567",
  required = false,
  className = "",
  disabled = false
}: LatamPhoneInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Detectar país inicial a partir del valor actual
  const detectCountry = (val: string): LatamCountry => {
    if (!val) return LATAM_COUNTRIES[0]; // Por defecto Colombia
    const clean = val.trim();
    // Ordenar de mayor a menor longitud de dialCode para evitar colisiones (ej. +593 antes de +5)
    const sorted = [...LATAM_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
    for (const c of sorted) {
      if (clean.startsWith(c.dialCode)) {
        return c;
      }
    }
    return LATAM_COUNTRIES[0];
  };

  const [selectedCountry, setSelectedCountry] = useState<LatamCountry>(() => detectCountry(value));

  // Extraer sólo los dígitos locales del valor completo
  const getLocalNumber = (val: string, country: LatamCountry): string => {
    if (!val) return "";
    let clean = val.trim();
    if (clean.startsWith(country.dialCode)) {
      clean = clean.substring(country.dialCode.length).trim();
    }
    return clean;
  };

  const [localNumber, setLocalNumber] = useState<string>(() => getLocalNumber(value, selectedCountry));

  // Sincronizar si el valor externo cambia (ej. al abrir modal para editar)
  useEffect(() => {
    const detected = detectCountry(value);
    setSelectedCountry(detected);
    setLocalNumber(getLocalNumber(value, detected));
  }, [value]);

  // Manejar click fuera del dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectCountry = (country: LatamCountry) => {
    setSelectedCountry(country);
    setIsOpen(false);
    setSearchQuery("");
    const combined = localNumber.trim() ? `${country.dialCode} ${localNumber.trim()}` : country.dialCode;
    onChange(combined);
  };

  const handleLocalNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9\s-]/g, ""); // Permitir sólo dígitos y guiones
    setLocalNumber(rawVal);
    const combined = rawVal.trim() ? `${selectedCountry.dialCode} ${rawVal.trim()}` : "";
    onChange(combined);
  };

  const filteredCountries = LATAM_COUNTRIES.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.dialCode.includes(q) ||
      c.code.toLowerCase().includes(q)
    );
  });

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Botón selector de bandera + código */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-1.5 px-3 py-2.5 bg-[#161616] border border-[#333333] border-r-0 rounded-l-xl text-sm font-medium text-white hover:bg-[#202020] focus:outline-none transition select-none disabled:opacity-50"
          title={`${selectedCountry.name} (${selectedCountry.dialCode})`}
        >
          <span className="text-lg leading-none">{selectedCountry.flag}</span>
          <span className="text-xs font-semibold text-zinc-300 font-mono">{selectedCountry.dialCode}</span>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
        </button>

        {/* Menú Desplegable con buscador */}
        {isOpen && (
          <div className="absolute top-full left-0 mt-1.5 w-64 max-h-72 bg-[#121212] border border-[#333333] rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col backdrop-blur-xl animate-in fade-in duration-150">
            {/* Buscador de países */}
            <div className="p-2 border-b border-[#262626] bg-[#161616] sticky top-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Buscar país o +código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#1e1e1e] border border-[#333333] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#E50914]"
                />
              </div>
            </div>

            {/* Lista de países */}
            <div className="overflow-y-auto divide-y divide-[#1e1e1e] flex-1 py-1">
              {filteredCountries.length === 0 ? (
                <div className="p-3 text-center text-xs text-zinc-500">No se encontraron países</div>
              ) : (
                filteredCountries.map((country) => {
                  const isSelected = country.code === selectedCountry.code;
                  return (
                    <button
                      key={country.code + country.dialCode}
                      type="button"
                      onClick={() => handleSelectCountry(country)}
                      className={`w-full px-3 py-2 flex items-center justify-between text-left text-xs transition ${
                        isSelected
                          ? "bg-[#E50914]/15 text-white font-bold"
                          : "text-zinc-300 hover:bg-[#1f1f1f] hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="text-base leading-none">{country.flag}</span>
                        <span className="truncate">{country.name}</span>
                      </div>
                      <span className="text-zinc-400 font-mono text-[11px] font-semibold shrink-0">
                        {country.dialCode}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input del número telefónico local */}
      <input
        type="tel"
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={localNumber}
        onChange={handleLocalNumberChange}
        className="w-full bg-[#161616] border border-[#333333] rounded-r-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] transition font-mono"
      />
    </div>
  );
}
