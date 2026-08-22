import React, { useId } from "react";
import { Language, t } from "../i18n.ts";
import { Languages } from "lucide-react";

interface LanguageSelectorProps {
  currentLanguage: Language;
  onLanguageChange: (newLang: Language) => void;
  variant?: "compact" | "card" | "pills";
  className?: string;
  namePrefix?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLanguage,
  onLanguageChange,
  variant = "pills",
  className = "",
  namePrefix,
}) => {
  const uniqueId = useId();
  const groupName = namePrefix ? `${namePrefix}_${uniqueId}` : `lang_radio_${uniqueId}`;

  if (variant === "compact") {
    return (
      <div className={`inline-flex items-center bg-slate-100 p-0.5 sm:p-1 rounded-xl border border-slate-200 shadow-2xs ${className}`}>
        <button
          type="button"
          onClick={() => onLanguageChange("en")}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer select-none ${
            currentLanguage === "en"
              ? "bg-white text-slate-900 shadow-xs border border-slate-200/90 text-[#65A30D]"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/60"
          }`}
          title="Switch to English"
        >
          <span className="shrink-0 text-xs">🇺🇸</span>
          <span>EN</span>
        </button>

        <button
          type="button"
          onClick={() => onLanguageChange("te")}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer select-none ${
            currentLanguage === "te"
              ? "bg-white text-slate-900 shadow-xs border border-slate-200/90 text-[#65A30D]"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/60"
          }`}
          title="తెలుగులోకి మార్చండి"
        >
          <span className="shrink-0 text-xs">🇮🇳</span>
          <span>తెలుగు</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1.5 w-full max-w-full min-w-0 ${className}`}>
      {variant === "card" && (
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <Languages className="w-4 h-4 text-[#65A30D]" />
          <span>{t("selectLanguage", currentLanguage)}</span>
        </div>
      )}

      <div className="grid grid-cols-2 w-full max-w-full bg-slate-100 p-1 rounded-2xl border border-slate-200/90 gap-1 shadow-2xs">
        {/* Radio Option 1: English */}
        <button
          type="button"
          onClick={() => onLanguageChange("en")}
          className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3.5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all select-none min-w-0 ${
            currentLanguage === "en"
              ? "bg-white text-slate-900 shadow-sm border border-slate-300/80 ring-2 ring-[#65A30D]/20 text-[#65A30D]"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
          }`}
        >
          <input
            type="radio"
            name={groupName}
            value="en"
            checked={currentLanguage === "en"}
            onChange={() => onLanguageChange("en")}
            className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#65A30D] accent-[#65A30D] cursor-pointer shrink-0 pointer-events-none"
            readOnly
          />
          <span className="flex items-center gap-1 min-w-0 truncate">
            <span className="shrink-0">🇺🇸</span>
            <span className="truncate">English</span>
          </span>
        </button>

        {/* Radio Option 2: Telugu */}
        <button
          type="button"
          onClick={() => onLanguageChange("te")}
          className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3.5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all select-none min-w-0 ${
            currentLanguage === "te"
              ? "bg-white text-slate-900 shadow-sm border border-slate-300/80 ring-2 ring-[#65A30D]/20 text-[#65A30D]"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
          }`}
        >
          <input
            type="radio"
            name={groupName}
            value="te"
            checked={currentLanguage === "te"}
            onChange={() => onLanguageChange("te")}
            className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#65A30D] accent-[#65A30D] cursor-pointer shrink-0 pointer-events-none"
            readOnly
          />
          <span className="flex items-center gap-1 min-w-0 truncate">
            <span className="shrink-0">🇮🇳</span>
            <span className="truncate">తెలుగు (Telugu)</span>
          </span>
        </button>
      </div>
    </div>
  );
};

export default LanguageSelector;

