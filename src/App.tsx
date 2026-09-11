import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Wrench, ShieldCheck, UserCheck, Lock, WifiOff, RefreshCw, KeyRound, X, User, LogOut, Sparkles, Eye, EyeOff } from "lucide-react";
import CustomerPortal from "./components/CustomerPortal.tsx";
import AdminPortal from "./components/AdminPortal.tsx";
import DinoGame from "./components/DinoGame.tsx";
import LoginPage from "./components/LoginPage.tsx";
import LanguageSelector from "./components/LanguageSelector.tsx";
import Skeleton from "./components/Skeleton.tsx";
import NotificationCenter from "./components/NotificationCenter.tsx";
import { UserProfile } from "./types.ts";
import { Language, getInitialLanguage, saveLanguage, t } from "./i18n.ts";
import { FIXHOME_LOGO } from "./assets/logoData.ts";
import { logNav } from "./utils/navLogger.ts";
import { notifyNativeBackState, exitNativeApp, showNativeToast } from "./utils/nativeBridge.ts";
import { secureStorage } from "./utils/secureStorage.ts";

function AppSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800 animate-fade-in-scale">
      {/* Top Fixed Navigation Header Skeleton */}
      <header className="bg-white/95 border-b border-slate-200/80 sticky top-0 z-50 backdrop-blur-md safe-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-900 overflow-hidden shadow-md border border-slate-700 shrink-0 p-0.5 flex items-center justify-center animate-pulse-glow">
              <img src={FIXHOME_LOGO} alt="FixHome Logo" className="w-full h-full object-cover rounded-xl" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-900 text-lg tracking-tight font-display">FixHome</span>
                <span className="w-2 h-2 rounded-full bg-[#65A30D] animate-ping" />
              </div>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Your Home, Our Care</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-24 rounded-xl bg-slate-200/80 shimmer-box" />
          </div>
        </div>
      </header>

      {/* Main Container Skeleton View */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-3 sm:px-6 pt-6 pb-20 space-y-4">
        {/* Banner Skeleton Card */}
        <div className="w-full h-36 sm:h-44 rounded-2xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 border border-slate-200/60 p-5 flex flex-col justify-between shimmer-box shadow-xs">
          <div className="space-y-2">
            <div className="h-5 w-2/5 bg-slate-300/80 rounded-lg" />
            <div className="h-3.5 w-3/5 bg-slate-200 rounded-md" />
          </div>
          <div className="h-10 w-36 bg-[#65A30D]/20 rounded-xl border border-[#65A30D]/30" />
        </div>

        {/* Offers Horizontal Scroll Skeleton */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-[#65A30D] animate-pulse" />
            <div className="h-4 w-44 bg-slate-200 rounded-md shimmer-box" />
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {[1, 2, 3].map((i) => (
              <div key={i} className="min-w-[250px] sm:min-w-[300px] p-3.5 bg-white border border-slate-200/80 rounded-2xl flex items-center gap-3 shrink-0 shadow-2xs">
                <div className="w-10 h-10 rounded-xl bg-slate-200 shrink-0 shimmer-box" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-2/3 bg-slate-200 rounded-md shimmer-box" />
                  <div className="h-2.5 w-4/5 bg-slate-100 rounded-md shimmer-box" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Grid Section Skeleton */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="h-4 w-52 bg-slate-200 rounded-md shimmer-box" />
            <div className="h-3.5 w-16 bg-slate-200 rounded-md shimmer-box" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                <div className="w-full h-36 bg-slate-200 shimmer-box" />
                <div className="p-4 space-y-2">
                  <div className="h-4 w-1/2 bg-slate-200 rounded-md shimmer-box" />
                  <div className="h-3 w-4/5 bg-slate-100 rounded-md shimmer-box" />
                  <div className="flex justify-between items-center pt-2">
                    <div className="h-3 w-1/3 bg-slate-100 rounded-md shimmer-box" />
                    <div className="h-8 w-20 bg-slate-200 rounded-xl shimmer-box" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer Status Skeleton */}
      <footer className="bg-white border-t border-slate-200 p-3.5 text-center mt-auto">
        <div className="h-3.5 w-44 mx-auto bg-slate-200 rounded-md shimmer-box" />
      </footer>
    </div>
  );
}

export default function App() {
  const [isAppInitializing, setIsAppInitializing] = useState<boolean>(true);
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAppInitializing(false);
    }, 350);
    return () => clearTimeout(timer);
  }, []);

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang);
    saveLanguage(newLang);
  };

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const savedName = secureStorage.getItem<string>("fix_home_user_name") || localStorage.getItem("fix_home_user_name");
      const savedMobile = secureStorage.getItem<string>("fix_home_user_mobile") || localStorage.getItem("fix_home_user_mobile");
      if (savedName && savedMobile) {
        return {
          name: savedName,
          mobile_number: savedMobile,
          id: secureStorage.getItem<string>("fix_home_user_id") || localStorage.getItem("fix_home_user_id") || undefined
        };
      }
    } catch (e) {}
    return null;
  });

  const [showLogin, setShowLogin] = useState<boolean>(!currentUser);
  const [navigationStack, setNavigationStack] = useState<Array<"customer" | "admin">>(["customer"]);
  const [activeTab, setActiveTab] = useState<"customer" | "admin">("customer");
  const [currentAdminTab, setCurrentAdminTab] = useState<string>("active");
  const [isOffline, setIsOffline] = useState<boolean>(() => typeof navigator !== "undefined" ? !navigator.onLine : false);
  const [isTrackingBooking, setIsTrackingBooking] = useState<boolean>(false);

  const handleLogout = () => {
    setCurrentUser(null);
    setShowLogin(true);
    try {
      secureStorage.removeItem("fix_home_user_mobile");
      secureStorage.removeItem("fix_home_user_name");
      secureStorage.removeItem("fix_home_user_id");
      secureStorage.removeItem("fix_home_active_booking_id");
      localStorage.removeItem("fix_home_user_mobile");
      localStorage.removeItem("fix_home_user_name");
      localStorage.removeItem("fix_home_user_id");
      localStorage.removeItem("fix_home_active_booking_id");
    } catch (e) {}
  };

  // --- DOUBLE BACK PRESS TO EXIT APP HANDLER ---
  const [backToastMessage, setBackToastMessage] = useState<string | null>(null);
  const lastBackPressRef = useRef<number>(0);
  const lastDispatchTimestampRef = useRef<number>(0);
  const subviewPoppedTimestampRef = useRef<number>(0);
  const lastPopStateTimeRef = useRef<number>(0);
  const currentHistoryStateRef = useRef<any>(typeof window !== "undefined" ? window.history.state : null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isExitingRef = useRef<boolean>(false);

  // Monkey-patch history pushState/replaceState to track accurate state before pop
  useEffect(() => {
    if (typeof window === "undefined") return;
    const origPush = window.history.pushState;
    const origReplace = window.history.replaceState;

    window.history.pushState = function (...args) {
      currentHistoryStateRef.current = args[0];
      return origPush.apply(this, args);
    };

    window.history.replaceState = function (...args) {
      currentHistoryStateRef.current = args[0];
      return origReplace.apply(this, args);
    };
  }, []);

  // --- SECRET ADMIN LONG-PRESS & SECURITY PIN STATES ---
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [showPinText, setShowPinText] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>("");
  const [pinError, setPinError] = useState<string>("");
  const [isHoldingLogo, setIsHoldingLogo] = useState<boolean>(false);
  const [holdProgress, setHoldProgress] = useState<number>(0);

  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const cancelHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setIsHoldingLogo(false);
    setHoldProgress(0);
  };

  const startHold = () => {
    cancelHold();
    setIsHoldingLogo(true);
    setHoldProgress(0);

    const startTime = Date.now();
    const DURATION = 3000; // 3 seconds requirement

    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / DURATION) * 100);
      setHoldProgress(progress);
    }, 50);

    holdTimerRef.current = setTimeout(() => {
      cancelHold();
      // Trigger Secret Admin Security Prompt
      setPinInput("");
      setPinError("");
      setShowPinText(false);
      logNav("App", "Opening Admin PIN modal via secret gesture", { activeTab });
      try {
        window.history.pushState({ fixHomeTab: activeTab, modal: "pin" }, "", "#modal-pin");
        notifyNativeBackState();
      } catch (e) {}
      setShowPinModal(true);
    }, DURATION);
  };

  useEffect(() => {
    setActiveTab("customer");
    setNavigationStack(["customer"]);
  }, []);

  const handlePinSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPin = pinInput.trim();
    // Admin Security PIN check
    if (cleanPin === "mammu@143") {
      setShowPinModal(false);
      setShowPinText(false);
      setPinInput("");
      setPinError("");
      logNav("App", "Admin PIN validated - switching to admin tab with pushState/replaceState");
      try {
        window.history.pushState({ fixHomeTab: "admin", section: "active" }, "", "#admin-active");
        notifyNativeBackState();
      } catch (err) {}
      setNavigationStack(["customer", "admin"]);
      setActiveTab("admin");
    } else {
      setPinError("Incorrect Admin Security PIN. Please try again.");
    }
  };

  // Sync app state ref for closure-safe access across hardware back and popstate
  const appStateRef = useRef({
    showPinModal,
    activeTab,
    language,
    showLogin,
    currentUser,
  });

  useEffect(() => {
    appStateRef.current = {
      showPinModal,
      activeTab,
      language,
      showLogin,
      currentUser,
    };
  });

  useEffect(() => {
    if (showPinModal || activeTab !== "customer") {
      notifyNativeBackState(true);
    }
  }, [showPinModal, activeTab]);

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
    };

    const handleOnline = () => {
      setIsOffline(false);
      // Automatically refresh the page when data/internet is restored so service portal opens freshly
      window.location.reload();
    };

    const handleHardwareBack = (e?: Event): boolean => {
      if (e && typeof e.preventDefault === "function") {
        e.preventDefault();
      }

      const now = Date.now();
      const current = appStateRef.current;

      // 0. Debounce duplicate dispatches of the SAME physical micro-tick across bridges (within 80ms)
      if (now - lastDispatchTimestampRef.current < 80) {
        logNav("HardwareBack", "Ignoring rapid duplicate event within 80ms", {
          delta: now - lastDispatchTimestampRef.current
        });
        return true;
      }
      lastDispatchTimestampRef.current = now;

      // If already in exit state, trigger exit directly
      if (isExitingRef.current) {
        exitNativeApp();
        return true;
      }

      // 1. PIN modal check -> Close modal
      if (current.showPinModal) {
        setShowPinModal(false);
        setPinInput("");
        setPinError("");
        lastBackPressRef.current = 0;
        subviewPoppedTimestampRef.current = now;
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setBackToastMessage(null);
        return true;
      }

      // 2. Admin portal check -> handle admin subviews/modals/tabs first, then return to Customer portal
      if (current.activeTab === "admin") {
        if (typeof (window as any).__adminPortalBack === "function") {
          const handledByAdmin = (window as any).__adminPortalBack();
          if (handledByAdmin) {
            logNav("HardwareBack", "Back event handled by sub-view in AdminPortal");
            lastBackPressRef.current = 0;
            subviewPoppedTimestampRef.current = now;
            isExitingRef.current = false;
            if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
            setBackToastMessage(null);
            return true;
          }
        }
        logNav("HardwareBack", "Admin root back press -> returning to Customer portal");
        setActiveTab("customer");
        setNavigationStack(["customer"]);
        lastBackPressRef.current = 0;
        subviewPoppedTimestampRef.current = now;
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setBackToastMessage(null);
        return true;
      }

      // 3. CustomerPortal sub-views check (Modals, Details step, Account tab, Tracker, Editing Profile)
      if (typeof (window as any).__customerPortalBack === "function") {
        const handledByPortal = (window as any).__customerPortalBack();
        if (handledByPortal) {
          logNav("HardwareBack", "Back event handled by sub-view in CustomerPortal");
          lastBackPressRef.current = 0;
          subviewPoppedTimestampRef.current = now;
          isExitingRef.current = false;
          if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
          setBackToastMessage(null);
          return true;
        }
      }

      // If a subview was just dismissed within the last 100ms, suppress root exit check
      if (now - subviewPoppedTimestampRef.current < 100) {
        logNav("HardwareBack", "Subview was recently dismissed; suppressing root exit check");
        return true;
      }

      // 4. ROOT LEVEL DOUBLE BACK TO EXIT (On the main Services/Home screen)
      const previousBackPress = lastBackPressRef.current;
      const timeDelta = previousBackPress > 0 ? now - previousBackPress : null;

      if (previousBackPress > 0 && timeDelta !== null && timeDelta >= 80 && timeDelta <= 4000) {
        // Genuine second back press within 4 seconds -> Trigger App Exit
        logNav("HardwareBack", "Second back press detected at root -> Exiting native app", { timeDelta });
        isExitingRef.current = true;
        lastBackPressRef.current = 0;
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setBackToastMessage(t("exitingApp", current.language) || "Exiting FixHome...");
        exitNativeApp();
        return true;
      } else {
        // First back press at root -> Show Toast and arm 4s timer
        logNav("HardwareBack", "First back press detected at root -> Showing 2-Tap exit toast", { previousBackPress, now });
        lastBackPressRef.current = now;
        isExitingRef.current = false;

        const toastMsg = t("pressBackToExit", current.language) || "Press back again to exit";
        setBackToastMessage(toastMsg);
        showNativeToast(toastMsg);
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => {
          logNav("HardwareBack", "2-Tap Exit Timer Expired -> Resetting lastBackPressRef to 0");
          lastBackPressRef.current = 0;
          setBackToastMessage(null);
        }, 4000);

        return true;
      }
    };

    const resetExitTimer = () => {
      lastBackPressRef.current = 0;
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setBackToastMessage(null);
    };

    // Push multiple guard buffer states so Android WebView and browsers always trigger popstate on back gesture
    const ensureGuardHistory = () => {
      try {
        if (typeof window !== "undefined" && window.history) {
          const currentPath = window.location.pathname + window.location.search;
          window.history.replaceState({ isRoot: true, page: "root", guardId: "base" }, "", currentPath + "#root");
          window.history.pushState({ isRoot: true, guard: true, guardId: "guard1" }, "", currentPath + "#app");
          window.history.pushState({ isRoot: true, guard: true, guardId: "guard2" }, "", currentPath + "#main");
        }
      } catch (e) {}
    };

    ensureGuardHistory();

    // Ensure guard entries exist upon first user interaction or app focus/resume
    const handleUserTouchActivation = () => {
      try {
        if (window.history && window.history.length <= 2) {
          ensureGuardHistory();
        }
      } catch (e) {}
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        logNav("Visibility", "App became visible -> re-ensuring guard history & resetting exit state");
        ensureGuardHistory();
        lastBackPressRef.current = 0;
        isExitingRef.current = false;
        setBackToastMessage(null);
      }
    };

    window.addEventListener("touchstart", handleUserTouchActivation, { passive: true });
    window.addEventListener("click", handleUserTouchActivation, { passive: true });
    window.addEventListener("pointerdown", handleUserTouchActivation, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const handlePopState = (e: PopStateEvent) => {
      logNav("PopState", "popstate event fired", { state: e.state });
      try {
        // ALWAYS keep history trapped by pushing state so the WebView never runs out of history
        window.history.pushState({ isRoot: true, guard: true, guardId: Date.now() }, "", window.location.pathname + window.location.search + "#app");
      } catch (err) {}
      handleHardwareBack(e);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("backbutton", (e) => handleHardwareBack(e));
    (window as any).__handleHardwareBack = handleHardwareBack;
    (window as any).__resetExitTimer = resetExitTimer;
    (window as any).__showExitToast = () => {
      const current = appStateRef.current;
      setBackToastMessage(t("pressBackToExit", current.language) || "Press back again to exit");
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setBackToastMessage(null);
      }, 3500);
    };
    (window as any).__showExitingToast = () => {
      const current = appStateRef.current;
      setBackToastMessage(t("exitingApp", current.language) || "Exiting FixHome...");
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("touchstart", handleUserTouchActivation);
      window.removeEventListener("click", handleUserTouchActivation);
      window.removeEventListener("pointerdown", handleUserTouchActivation);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      delete (window as any).__handleHardwareBack;
      delete (window as any).__resetExitTimer;
      delete (window as any).__showExitToast;
      delete (window as any).__showExitingToast;
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      cancelHold();
    };
  }, []);

  // SHOW APP SKELETON SCREEN ON INITIAL MOUNT TO PREVENT WHITE SCREEN AND LOGO FLICKER
  if (isAppInitializing) {
    return <AppSkeleton />;
  }

  // SHOW LOGIN PAGE AS SOON AS APP OPENS IF USER IS NOT LOGGED IN
  if (showLogin || !currentUser) {
    return (
      <>
        <LoginPage
          currentLanguage={language}
          onLanguageChange={handleLanguageChange}
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            setShowLogin(false);
          }}
        />

        {/* DOUBLE BACK PRESS TO EXIT TOAST */}
        <AnimatePresence>
          {backToastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[999999] pointer-events-none px-6 py-3.5 bg-slate-950 text-white text-xs font-bold rounded-full shadow-2xl border border-slate-700/90 flex items-center gap-3 backdrop-blur-md ring-1 ring-white/20"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#84cc16] animate-ping shrink-0" />
              <span className="tracking-wide text-sm font-semibold whitespace-nowrap">{backToastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased relative">
      {/* SECRET ADMIN PIN SECURITY PROMPT MODAL */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 relative text-left">
            <button
              onClick={() => {
                setShowPinModal(false);
                setShowPinText(false);
                setPinError("");
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
            >
              <X size={18} />
            </button>

            <div className="w-12 h-12 bg-lime-100 text-[#65A30D] rounded-2xl flex items-center justify-center mb-4 ring-8 ring-lime-50">
              <KeyRound size={24} />
            </div>

            <h3 className="text-lg font-extrabold text-slate-900 font-display">
              {t("adminSecurityAccess", language)}
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              {t("secretGestureDetected", language)}
            </p>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                  {t("adminSecurityPin", language)}
                </label>
                <div className="relative">
                  <input
                    type={showPinText ? "text" : "password"}
                    autoFocus
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      if (pinError) setPinError("");
                    }}
                    placeholder={t("enterSecurityPin", language)}
                    className="w-full px-4 py-3 pr-11 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#65A30D] focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPinText(!showPinText)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 rounded-lg transition-colors cursor-pointer"
                    title={showPinText ? "Hide PIN" : "Show PIN"}
                  >
                    {showPinText ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {pinError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold rounded-xl">
                  {pinError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    logNav("App", "User clicked Cancel on PIN modal", { state: window.history.state });
                    if (window.history.state?.modal === "pin") {
                      window.history.back();
                    } else {
                      setShowPinModal(false);
                    }
                    setShowPinText(false);
                    setPinError("");
                  }}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                >
                  {t("cancel", language)}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-[#65A30D] hover:bg-[#52840a] text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
                >
                  {t("unlockPortal", language)}
                </button>
              </div>

              <p className="text-[10px] text-center text-slate-400 pt-1">
                {t("authorizedPersonnelOnly", language)}
              </p>
            </form>
          </div>
        </div>
      )}

      {/* OFFLINE SCREEN OVERLAY WITH DINO GAME */}
      {isOffline && (
        <div className="fixed inset-0 z-50 bg-slate-900/98 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 text-center text-white animate-fade-in overflow-y-auto">
          <div className="w-20 h-20 rounded-2xl overflow-hidden mb-3 border-2 border-white/20 shadow-2xl shrink-0">
            <img src={FIXHOME_LOGO} alt="FixHome Logo" className="w-full h-full object-cover" />
          </div>

          <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider mb-2 shrink-0">
            {t("noInternetConnection", language)}
          </span>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-display mb-1 shrink-0">
            {t("appName", language)}
          </h2>

          <p className="text-base sm:text-lg font-bold text-amber-300 max-w-sm leading-relaxed mb-4 shrink-0">
            {t("pleaseConnectInternet", language)}
          </p>

          <p className="text-xs text-slate-300 mb-4 max-w-xs shrink-0">
            {t("turnOnDataOrWifi", language)}
          </p>

          {/* DINO RUNNER GAME */}
          <DinoGame currentLanguage={language} />

          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs mt-2 shrink-0">
            <button
              onClick={() => {
                if (navigator.onLine) {
                  setIsOffline(false);
                  window.location.reload();
                } else {
                  alert(t("youAreOffline", language));
                }
              }}
              className="w-full py-3.5 px-6 bg-[#65A30D] hover:bg-[#52840a] text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <RefreshCw size={16} />
              <span>{t("retryConnection", language)}</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-500 mt-6 font-mono shrink-0">
            {t("autoReconnectEnabled", language)}
          </p>
        </div>
      )}

      {/* STANDARD NAVIGATION HEADER - FIXED AT TOP */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 border-b border-slate-200/80 shadow-xs backdrop-blur-md safe-header">
        <div className={`w-full mx-auto px-3.5 sm:px-4 h-16 flex items-center justify-between gap-3 transition-all duration-300 ${
          activeTab === "customer" ? "max-w-md" : "max-w-7xl"
        }`}>
          
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2.5">
            <div
              onMouseDown={startHold}
              onMouseUp={cancelHold}
              onMouseLeave={cancelHold}
              onTouchStart={startHold}
              onTouchEnd={cancelHold}
              onTouchCancel={cancelHold}
              onContextMenu={(e) => e.preventDefault()}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center shadow-md select-none cursor-pointer relative overflow-hidden transition-all bg-slate-900 border border-slate-200 ${
                isHoldingLogo ? "scale-95 ring-4 ring-lime-400/60" : "hover:scale-105"
              }`}
              title="FixHome Logo (Long press for Admin Portal)"
            >
              <img
                src={FIXHOME_LOGO}
                alt="FixHome Logo"
                className="w-full h-full object-cover rounded-2xl pointer-events-none"
              />
              {/* Hold progress animated ring/fill background */}
              {isHoldingLogo && (
                <div
                  className="absolute inset-0 bg-[#65A30D]/60 backdrop-blur-[1px] transition-all duration-75 flex items-center justify-center"
                  style={{ opacity: holdProgress / 100 }}
                />
              )}
            </div>

            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none font-display">
              FixHome
            </h1>
          </div>

          {/* Header Controls: FCM Notification Center & Navigation */}
          <div className="flex items-center gap-2">
            {activeTab === "admin" && (
              <NotificationCenter
                userRole="admin"
                userPhone={currentUser?.mobile_number}
              />
            )}

            {activeTab === "admin" && (
              <button
                type="button"
                onClick={() => {
                  logNav("App", "User clicked Return to User Portal button - switching directly to Customer Portal");
                  try {
                    window.history.pushState({ fixHomeTab: "customer", section: "book", isRoot: true }, "", "#customer-book");
                    notifyNativeBackState();
                  } catch (e) {}
                  setNavigationStack(["customer"]);
                  setActiveTab("customer");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="px-3.5 py-2 bg-[#65A30D] hover:bg-[#52840a] text-white rounded-xl transition-all text-xs font-extrabold flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
                title="Navigate to User Portal"
              >
                <User size={15} />
                <span>User Portal</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN VIEW CONTENT CONTAINER WITH TOP PADDING FOR FIXED HEADER AND BOTTOM PADDING FOR FIXED FOOTER */}
      <main className={`flex-1 w-full mx-auto px-2 sm:px-4 safe-main-content landscape:pb-16 flex flex-col justify-start transition-all duration-300 ${
        activeTab === "customer" ? "max-w-2xl" : "max-w-7xl"
      }`}>
        <div className="w-full bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col flex-1 min-h-[500px] sm:min-h-[680px] landscape:min-h-0 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: activeTab === "admin" ? 24 : -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: activeTab === "admin" ? -24 : 24 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="w-full flex-1 flex flex-col"
            >
              {activeTab === "customer" ? (
                <CustomerPortal
                  onTrackerStateChange={setIsTrackingBooking}
                  currentLanguage={language}
                  onLanguageChange={handleLanguageChange}
                  onLogout={handleLogout}
                />
              ) : (
                <AdminPortal
                  onAdminTabChange={setCurrentAdminTab}
                  currentLanguage={language}
                  onLanguageChange={handleLanguageChange}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* DOUBLE BACK PRESS TO EXIT TOAST OVERLAY */}
      <AnimatePresence>
        {backToastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[999999] pointer-events-none px-6 py-3.5 bg-slate-950 text-white text-xs font-bold rounded-full shadow-2xl border border-slate-700/90 flex items-center gap-3 backdrop-blur-md ring-1 ring-white/20"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#84cc16] animate-ping shrink-0" />
            <span className="tracking-wide text-sm font-semibold whitespace-nowrap">{backToastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

