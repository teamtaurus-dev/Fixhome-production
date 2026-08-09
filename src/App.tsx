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
import { notifyNativeBackState, exitNativeApp } from "./utils/nativeBridge.ts";

function AppSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800 animate-fade-in-scale">
      {/* Top Fixed Navigation Header Skeleton */}
      <header className="bg-white/95 border-b border-slate-200/80 sticky top-0 z-50 backdrop-blur-md h-16">
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
      const savedName = localStorage.getItem("fix_home_user_name");
      const savedMobile = localStorage.getItem("fix_home_user_mobile");
      if (savedName && savedMobile) {
        return {
          name: savedName,
          mobile_number: savedMobile,
          id: localStorage.getItem("fix_home_user_id") || undefined
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
      localStorage.removeItem("fix_home_user_mobile");
      localStorage.removeItem("fix_home_user_name");
      localStorage.removeItem("fix_home_user_id");
      localStorage.removeItem("fix_home_active_booking_id");
    } catch (e) {}
  };

  // --- DOUBLE BACK PRESS TO EXIT APP HANDLER ---
  const [backToastMessage, setBackToastMessage] = useState<string | null>(null);
  const lastBackPressRef = useRef<number>(0);
  const lastPopStateTimeRef = useRef<number>(0);
  const currentHistoryStateRef = useRef<any>(typeof window !== "undefined" ? window.history.state : null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    if (!window.history.state || !window.history.state.fixHomeTab) {
      logNav("AppInit", "Initializing root history state with base guard");
      try {
        window.history.replaceState({ isRootGuard: true }, "", "#root-guard");
        const rootState = { fixHomeTab: "customer", section: "book", isRoot: true };
        window.history.pushState(rootState, "", "#customer-book");
        currentHistoryStateRef.current = rootState;
        notifyNativeBackState();
      } catch (e) {}
    } else {
      const st = window.history.state;
      currentHistoryStateRef.current = st;
      logNav("AppInit", "Restored existing history state", { state: st });
      setShowPinModal(st.modal === "pin");
      if (st.fixHomeTab === "admin") {
        setNavigationStack(["customer", "admin"]);
        setActiveTab("admin");
      } else {
        setNavigationStack(["customer"]);
        setActiveTab("customer");
      }
      notifyNativeBackState();
    }
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

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
    };

    const handleOnline = () => {
      setIsOffline(false);
      // Automatically refresh the page when data/internet is restored so service portal opens freshly
      window.location.reload();
    };

    const handlePopState = (e: PopStateEvent) => {
      const now = Date.now();
      lastPopStateTimeRef.current = now;

      const poppedState = currentHistoryStateRef.current;
      const currentState = e.state;
      currentHistoryStateRef.current = currentState;

      const previousBackPress = lastBackPressRef.current;
      const timeDelta = previousBackPress > 0 ? now - previousBackPress : null;

      // Check if user landed on the base root guard entry
      const isNullState = !currentState;
      const hasIsRootGuardFlag = Boolean(currentState?.isRootGuard);
      const lacksFixHomeTab = !currentState?.fixHomeTab;
      const isAtRootGuard = isNullState || hasIsRootGuardFlag || lacksFixHomeTab;

      logNav("PopStateAudit", "popstate event intercepted", {
        timestamp: new Date().toISOString(),
        poppedState,
        currentState,
        historyLength: typeof window !== "undefined" ? window.history.length : 0,
        isAtRootGuard,
        previousBackPress,
        timeDelta,
        activeTab,
      });

      if (!isAtRootGuard) {
        // User popped back to a valid screen or sub-view (e.g., Account tab, modal, or returning to Book tab)
        logNav("PopStateAudit", "Decision: SUB_VIEW_POP -> Resetting double-back timer", {
          closingModal: poppedState?.modal,
          returningToTab: currentState?.fixHomeTab,
          returningToSection: currentState?.section,
        });

        lastBackPressRef.current = 0;
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setBackToastMessage(null);

        setShowPinModal(currentState?.modal === "pin");
        if (currentState?.fixHomeTab === "admin") {
          setNavigationStack(["customer", "admin"]);
          setActiveTab("admin");
        } else {
          setNavigationStack(["customer"]);
          setActiveTab("customer");
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
        notifyNativeBackState();
        return;
      }

      // User popped past #customer-book and landed on #root-guard

      // 1. Debounce duplicate callback within 300ms from same physical back tap
      if (previousBackPress > 0 && timeDelta !== null && timeDelta < 300) {
        logNav("PopStateAudit", "Decision: DUPLICATE_EVENT_DEBOUNCED -> Re-arming root history state", { timeDelta });
        try {
          window.history.replaceState({ isRootGuard: true }, "", "#root-guard");
          const rootState = { fixHomeTab: "customer", section: "book", isRoot: true };
          window.history.pushState(rootState, "", "#customer-book");
          currentHistoryStateRef.current = rootState;
          notifyNativeBackState();
        } catch (err) {}
        return;
      }

      // 2. Second back press within 2.5 seconds -> Exit App
      if (previousBackPress > 0 && timeDelta !== null && timeDelta >= 300 && timeDelta < 2500) {
        logNav("PopStateAudit", "Decision: SECOND_BACK_PRESS_EXIT_TRIGGERED -> Triggering exitNativeApp()", {
          previousBackPress,
          now,
          timeDelta,
          thresholdMs: 2500,
        });

        setBackToastMessage(t("exitingApp", language));
        exitNativeApp();
        return;
      }

      // 3. First Back Press at Root -> Re-push active root state & show 2-Tap Toast
      logNav("PopStateAudit", "Decision: FIRST_BACK_PRESS_ROOT_TRAPPED -> Showing 2-Tap Toast & Re-pushing Root State", {
        previousBackPress,
        now,
        timeDelta,
      });

      lastBackPressRef.current = now;
      try {
        window.history.replaceState({ isRootGuard: true }, "", "#root-guard");
        const rootState = { fixHomeTab: "customer", section: "book", isRoot: true };
        window.history.pushState(rootState, "", "#customer-book");
        currentHistoryStateRef.current = rootState;
        notifyNativeBackState();
      } catch (err) {
        console.error("Failed to re-push rootState in handlePopState:", err);
      }

      setBackToastMessage(t("pressBackToExit", language));
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        logNav("PopStateAudit", "2-Tap Exit Timer Expired -> Resetting lastBackPressRef to 0");
        setBackToastMessage(null);
        lastBackPressRef.current = 0;
      }, 2500);
    };

    const handleHardwareBack = (e?: Event): boolean => {
      if (e && typeof e.preventDefault === "function") {
        e.preventDefault();
      }

      const now = Date.now();
      // If popstate already handled this back press within last 200ms, do not trigger duplicate pop
      if (now - lastPopStateTimeRef.current < 200) {
        logNav("HardwareBack", "popstate already handled this back press within 200ms -> skipping duplicate history.back()");
        return true;
      }

      const st = window.history.state || currentHistoryStateRef.current || {};
      const isNullState = !st;
      const hasIsRootGuardFlag = Boolean(st.isRootGuard);
      const lacksFixHomeTab = !st.fixHomeTab;
      const isAtRoot = isNullState || hasIsRootGuardFlag || lacksFixHomeTab;

      logNav("HardwareBack", "Hardware back button callback invoked", {
        isAtRoot,
        st,
        lastBackPress: lastBackPressRef.current,
      });

      if (!isAtRoot) {
        // User is on a sub-view/modal -> Navigate back in JS history
        lastBackPressRef.current = 0;
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setBackToastMessage(null);

        window.history.back();
        notifyNativeBackState();
        return true; // Signal native container that JS consumed the back event
      }

      // User is at ROOT level
      const previousBackPress = lastBackPressRef.current;
      const timeDelta = previousBackPress > 0 ? now - previousBackPress : null;

      if (previousBackPress > 0 && timeDelta !== null && timeDelta < 300) {
        // Duplicate callback from same physical tap -> return true (consumed)
        return true;
      }

      if (previousBackPress > 0 && timeDelta !== null && timeDelta >= 300 && timeDelta < 2500) {
        // Second back press within 2.5s -> Trigger native exit
        logNav("HardwareBack", "Second back press detected at root -> Exiting native app");
        setBackToastMessage(t("exitingApp", language));
        exitNativeApp();
        return false; // Signal native container to proceed with exit
      } else {
        // First back press at root -> Show 2-Tap Toast & stay on screen
        logNav("HardwareBack", "First back press detected at root -> Showing 2-Tap exit toast");
        lastBackPressRef.current = now;

        try {
          window.history.replaceState({ isRootGuard: true }, "", "#root-guard");
          const rootState = { fixHomeTab: "customer", section: "book", isRoot: true };
          window.history.pushState(rootState, "", "#customer-book");
          currentHistoryStateRef.current = rootState;
          notifyNativeBackState();
        } catch (err) {}

        setBackToastMessage(t("pressBackToExit", language));
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => {
          logNav("HardwareBack", "2-Tap Exit Timer Expired -> Resetting lastBackPressRef to 0");
          setBackToastMessage(null);
          lastBackPressRef.current = 0;
        }, 2500);

        return true; // Signal native container that JS consumed the back event
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("hashchange", handlePopState);
    document.addEventListener("backbutton", handleHardwareBack);
    (window as any).onHardwareBackPress = handleHardwareBack;
    (window as any).onBackPressed = handleHardwareBack;
    (window as any).handleBackPress = handleHardwareBack;
    (window as any).onAndroidBackPress = handleHardwareBack;
    (window as any).handleAndroidBack = handleHardwareBack;

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("hashchange", handlePopState);
      document.removeEventListener("backbutton", handleHardwareBack);
      delete (window as any).onHardwareBackPress;
      delete (window as any).onBackPressed;
      delete (window as any).handleBackPress;
      delete (window as any).onAndroidBackPress;
      delete (window as any).handleAndroidBack;
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      cancelHold();
    };
  }, [language]);

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
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none px-5 py-2.5 bg-slate-900/95 text-white text-xs font-bold rounded-full shadow-2xl border border-slate-700/60 flex items-center gap-2.5 backdrop-blur-md"
            >
              <span className="w-2 h-2 rounded-full bg-[#84cc16] animate-ping shrink-0" />
              <span>{backToastMessage}</span>
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
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 border-b border-slate-200/80 shadow-xs backdrop-blur-md h-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div
              onMouseDown={startHold}
              onMouseUp={cancelHold}
              onMouseLeave={cancelHold}
              onTouchStart={startHold}
              onTouchEnd={cancelHold}
              onTouchCancel={cancelHold}
              onContextMenu={(e) => e.preventDefault()}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-md select-none cursor-pointer relative overflow-hidden transition-all bg-slate-900 border border-slate-200 ${
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
          <div className="flex items-center gap-2.5">
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
      <main className="flex-1 w-full max-w-4xl mx-auto px-3 sm:px-6 pt-20 sm:pt-22 pb-20 sm:pb-24 landscape:pb-16 flex flex-col justify-start">
        <div className="w-full bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col flex-1 min-h-[500px] sm:min-h-[680px] landscape:min-h-0 relative">
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
                <AdminPortal onAdminTabChange={setCurrentAdminTab} />
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
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none px-5 py-2.5 bg-slate-900/95 text-white text-xs font-bold rounded-full shadow-2xl border border-slate-700/60 flex items-center gap-2.5 backdrop-blur-md"
          >
            <span className="w-2 h-2 rounded-full bg-[#84cc16] animate-ping shrink-0" />
            <span>{backToastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

