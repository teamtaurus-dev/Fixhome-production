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

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {variant === "card" && (
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <Languages className="w-4 h-4 text-[#65A30D]" />
          <span>{t("selectLanguage", currentLanguage)}</span>
        </div>
      )}

      <div className="inline-flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200/90 gap-1.5 shadow-2xs">
        {/* Radio Option 1: English */}
        <label
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all select-none ${
            currentLanguage === "en"
              ? "bg-white text-slate-900 shadow-sm border border-slate-300/80 ring-2 ring-[#65A30D]/20"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
          }`}
        >
          <input
            type="radio"
            name={groupName}
            value="en"
            checked={currentLanguage === "en"}
            onChange={() => onLanguageChange("en")}
            className="w-4 h-4 text-[#65A30D] accent-[#65A30D] cursor-pointer"
          />
          <span className="flex items-center gap-1">
            <span>🇺🇸</span>
            <span>English</span>
          </span>
        </label>

        {/* Radio Option 2: Telugu */}
        <label
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all select-none ${
            currentLanguage === "te"
              ? "bg-white text-slate-900 shadow-sm border border-slate-300/80 ring-2 ring-[#65A30D]/20"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
          }`}
        >
          <input
            type="radio"
            name={groupName}
            value="te"
            checked={currentLanguage === "te"}
            onChange={() => onLanguageChange("te")}
            className="w-4 h-4 text-[#65A30D] accent-[#65A30D] cursor-pointer"
          />
          <span className="flex items-center gap-1">
            <span>🇮🇳</span>
            <span>తెలుగు (Telugu)</span>
          </span>
        </label>
      </div>
    </div>
  );
};

export default LanguageSelector;
