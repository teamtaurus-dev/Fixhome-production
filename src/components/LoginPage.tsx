import React, { useState } from "react";
import { User, Phone, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { UserProfile } from "../types.ts";
import { Language, t } from "../i18n.ts";
import LanguageSelector from "./LanguageSelector.tsx";
import { FIXHOME_LOGO } from "../assets/logoData.ts";
import { isValidName, sanitizeNameInput, isValidPhoneNumber } from "../utils/validation.ts";

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
  currentLanguage?: Language;
  onLanguageChange?: (lang: Language) => void;
}

export default function LoginPage({
  onLoginSuccess,
  currentLanguage = "en",
  onLanguageChange = () => {},
}: LoginPageProps) {
  const [name, setName] = useState<string>("");
  const [mobileNumber, setMobileNumber] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanName = name.trim();
    const cleanMobile = mobileNumber.replace(/\D/g, "");

    if (!isValidName(cleanName)) {
      setError(t("errEnterName", currentLanguage));
      return;
    }

    if (!isValidPhoneNumber(cleanMobile)) {
      setError(t("errEnterMobile", currentLanguage));
      return;
    }

    // Instant local save and screen transition for seamless zero-delay UX
    try {
      localStorage.setItem("fix_home_user_name", cleanName);
      localStorage.setItem("fix_home_user_mobile", cleanMobile);
      localStorage.setItem("fix_home_privacy_accepted", "true");
    } catch (e) {
      console.error("Failed to save to localStorage", e);
    }

    // Immediately trigger login success so user enters app without any blank screen or delay!
    onLoginSuccess({
      name: cleanName,
      mobile_number: cleanMobile,
    });

    // Background sync to permanently store in PostgreSQL / database
    fetch("/api/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: cleanName,
        mobile_number: cleanMobile,
      }),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user && data.user.id) {
            try {
              localStorage.setItem("fix_home_user_id", data.user.id);
            } catch (e) {}
          }
        }
      })
      .catch((err) => {
        console.error("Background user registration sync error:", err);
      });
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-800 antialiased font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-lime-500/10 via-emerald-500/5 to-transparent pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden relative z-10 animate-fade-in">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-6 sm:p-8 text-white text-center relative">
          <div className="mx-auto w-20 h-20 bg-slate-800/80 rounded-2xl p-1 shadow-xl border border-slate-700 flex items-center justify-center mb-3 group transition-transform hover:scale-105">
            <img
              src={FIXHOME_LOGO}
              alt="FixHome Logo"
              className="w-full h-full object-cover rounded-xl"
            />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-lime-500/20 text-lime-300 border border-lime-500/30 text-[10px] font-extrabold rounded-full uppercase tracking-wider mb-2">
            <ShieldCheck size={12} />
            <span>{t("verifiedApp", currentLanguage)}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-display text-white">
            {t("loginTitle", currentLanguage)}
          </h1>
          <p className="text-xs text-slate-300 font-medium mt-1.5 leading-relaxed max-w-xs mx-auto">
            {t("loginSubtitle", currentLanguage)}
          </p>
        </div>

        {/* Login Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5 bg-white">
          {/* Radio Button Language Selector Component */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col items-center justify-center gap-2">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              {t("chooseLanguage", currentLanguage)}
            </span>
            <LanguageSelector
              currentLanguage={currentLanguage}
              onLanguageChange={onLanguageChange}
              variant="pills"
            />
          </div>

          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 mt-1 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Name Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
              {t("fullNameLabel", currentLanguage)} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User size={18} />
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  const sanitized = sanitizeNameInput(e.target.value);
                  setName(sanitized);
                  if (error) setError("");
                }}
                placeholder={t("fullNamePlaceholder", currentLanguage)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#65A30D] focus:border-transparent transition-all placeholder:text-slate-400 placeholder:font-normal"
              />
            </div>
          </div>

          {/* Mobile Number Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
              {t("mobileLabel", currentLanguage)} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                <Phone size={18} />
              </div>
              <input
                type="tel"
                required
                maxLength={15}
                value={mobileNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setMobileNumber(val);
                  if (error) setError("");
                }}
                placeholder={t("mobilePlaceholder", currentLanguage)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#65A30D] focus:border-transparent transition-all placeholder:text-slate-400 placeholder:font-normal font-mono"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-6 bg-[#65A30D] hover:bg-[#52840a] text-white rounded-xl font-extrabold text-sm uppercase tracking-wider shadow-lg shadow-lime-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60 disabled:pointer-events-none mt-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{t("savingDetails", currentLanguage)}</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span>{t("getStarted", currentLanguage)}</span>
                <ArrowRight size={18} />
              </span>
            )}
          </button>

          {/* Trust points */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-4 text-[11px] text-slate-500 font-medium">
            <span className="flex items-center gap-1 text-slate-600">
              <CheckCircle2 size={13} className="text-[#65A30D]" /> {t("permanentAccount", currentLanguage)}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-slate-600">
              <CheckCircle2 size={13} className="text-[#65A30D]" /> {t("instantDispatch", currentLanguage)}
            </span>
          </div>
        </form>
      </div>

      <p className="text-[11px] text-slate-400 mt-6 text-center font-mono">
        {t("platformTagline", currentLanguage)}
      </p>
    </div>
  );
}
