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

  const detectCountry = (val: string): LatamCountry => {
    if (!val) return LATAM_COUNTRIES[0];
    const match = LATAM_COUNTRIES.find((c) => val.startsWith(c.dialCode));
    return match || LATAM_COUNTRIES[0];
  };

  const [selectedCountry, setSelectedCountry] = useState<LatamCountry>(() => detectCountry(value));
  const [localNumber, setLocalNumber] = useState<string>(() => {
    if (!value) return "";
    const country = detectCountry(value);
    return value.replace(country.dialCode, "").trim();
  });

  useEffect(() => {
    if (!value) {
      setLocalNumber("");
      return;
    }
    const country = detectCountry(value);
    setSelectedCountry(country);
    setLocalNumber(value.replace(country.dialCode, "").trim());
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectCountry = (country: LatamCountry) => {
    setSelectedCountry(country);
    setIsOpen(false);
    setSearchQuery("");
    const combined = localNumber.trim() ? `${country.dialCode} ${localNumber.trim()}` : "";
    onChange(combined);
  };

  const handleLocalNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^\d\s-]/g, "");
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
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0E121B] border border-slate-800 border-r-0 rounded-l-xl text-sm font-medium text-slate-100 hover:bg-[#141A25] focus:outline-none transition select-none disabled:opacity-50"
          title={`${selectedCountry.name} (${selectedCountry.dialCode})`}
        >
          <span className="text-lg leading-none">{selectedCountry.flag}</span>
          <span className="text-xs font-semibold text-slate-300 font-mono">{selectedCountry.dialCode}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1.5 w-64 max-h-72 bg-[#121722] border border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col backdrop-blur-xl animate-in fade-in duration-150">
            <div className="p-2 border-b border-slate-800 bg-[#0E121B] sticky top-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Buscar país o +código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#182030] border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="overflow-y-auto divide-y divide-slate-800 flex-1 py-1">
              {filteredCountries.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-400">No se encontraron países</div>
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
                          ? "bg-blue-500/15 text-blue-300 font-semibold"
                          : "text-slate-300 hover:bg-[#182030] hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="text-base leading-none">{country.flag}</span>
                        <span className="truncate">{country.name}</span>
                      </div>
                      <span className="text-slate-400 font-mono text-[11px] font-semibold shrink-0">
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

      <input
        type="tel"
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={localNumber}
        onChange={handleLocalNumberChange}
        className="w-full bg-[#0E121B] border border-slate-800 rounded-r-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition font-sans"
      />
    </div>
  );
}
