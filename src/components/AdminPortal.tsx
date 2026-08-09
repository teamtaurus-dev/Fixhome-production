import React, { useState, useEffect, useRef } from "react";
import { 
  Lock, 
  Eye,
  EyeOff,
  Phone, 
  FileText, 
  Wrench, 
  PlusCircle, 
  Trash2, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  LogOut, 
  ShieldAlert, 
  RefreshCw,
  Image as ImageIcon,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  ShieldX,
  Timer,
  ExternalLink,
  Copy,
  Share2,
  Check,
  Send,
  X,
  Users,
  Tag,
  Percent,
  Sparkles,
  UserCheck,
  Briefcase,
  Award,
  Gift,
  History,
  Search,
  Download,
  Filter,
  Calendar,
  Archive,
  Pencil,
  DollarSign,
  Sliders,
  Plus
} from "lucide-react";
import { Category, Booking, Worker, Offer } from "../types.ts";
import { FIXHOME_LOGO } from "../assets/logoData.ts";
import { logNav } from "../utils/navLogger.ts";
import { notifyNativeBackState } from "../utils/nativeBridge.ts";
import Skeleton from "./Skeleton.tsx";
import { parseSubcategoryItem, formatSubcategoryDisplay } from "../utils/categoryUtils.ts";
import { sendFCMPushNotification } from "../lib/notifications.ts";

function safeText(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
    return String(val);
  }
  if (typeof val === "object") {
    if (val.type === "Buffer" && Array.isArray(val.data)) {
      try {
        return String.fromCharCode(...val.data);
      } catch (e) {
        return "";
      }
    }
    return JSON.stringify(val);
  }
  return String(val);
}

interface AdminLockoutData {
  tier1Attempts: number; // 0..5
  tier1LockUntil: number | null; // timestamp ms
  hasCompletedTier1Lock: boolean; // boolean
  tier2Attempts: number; // 0..3
  tier2LockUntil: number | null; // timestamp ms
}

const loadLockoutData = (): AdminLockoutData => {
  try {
    const raw = localStorage.getItem("fix_home_admin_lockout_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        tier1Attempts: Number(parsed.tier1Attempts) || 0,
        tier1LockUntil: parsed.tier1LockUntil ? Number(parsed.tier1LockUntil) : null,
        hasCompletedTier1Lock: Boolean(parsed.hasCompletedTier1Lock),
        tier2Attempts: Number(parsed.tier2Attempts) || 0,
        tier2LockUntil: parsed.tier2LockUntil ? Number(parsed.tier2LockUntil) : null,
      };
    }
  } catch (e) {}
  return {
    tier1Attempts: 0,
    tier1LockUntil: null,
    hasCompletedTier1Lock: false,
    tier2Attempts: 0,
    tier2LockUntil: null,
  };
};

const saveLockoutData = (data: AdminLockoutData) => {
  try {
    localStorage.setItem("fix_home_admin_lockout_v1", JSON.stringify(data));
  } catch (e) {}
};

const formatTimeRemaining = (ms: number): string => {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

interface AdminPortalProps {
  key?: React.Key;
  onAdminTabChange?: (tab: "active" | "all" | "history" | "workers" | "offers" | "categories") => void;
}

export default function AdminPortal({ onAdminTabChange }: AdminPortalProps = {}) {
  // --- SESSION STATES ---
  const [token, setToken] = useState<string>(() => 
    localStorage.getItem("fix_home_admin_token") || sessionStorage.getItem("fix_home_admin_token") || ""
  );
  const [adminPhone, setAdminPhone] = useState<string>(() => 
    localStorage.getItem("fix_home_admin_phone") || sessionStorage.getItem("fix_home_admin_phone") || ""
  );
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const savedToken = localStorage.getItem("fix_home_admin_token") || sessionStorage.getItem("fix_home_admin_token");
    const savedPhone = localStorage.getItem("fix_home_admin_phone") || sessionStorage.getItem("fix_home_admin_phone");
    return !!(savedToken && savedPhone);
  });
  
  // Login Form Inputs & Security Lockout
  const [loginPhone, setLoginPhone] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>("");
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [lockoutData, setLockoutData] = useState<AdminLockoutData>(loadLockoutData);
  const [now, setNow] = useState<number>(Date.now());

  // --- DATA STATES ---
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loadingBookings, setLoadingBookings] = useState<boolean>(false);
  const [loadingCats, setLoadingCats] = useState<boolean>(false);
  const [loadingWorkers, setLoadingWorkers] = useState<boolean>(false);
  const [loadingOffers, setLoadingOffers] = useState<boolean>(false);

  // Workers Form State
  const [newWorkerName, setNewWorkerName] = useState<string>("");
  const [newWorkerPhone, setNewWorkerPhone] = useState<string>("");
  const [newWorkerCategory, setNewWorkerCategory] = useState<string>("");
  const [newWorkerPhoto, setNewWorkerPhoto] = useState<string>("");
  const [newWorkerPhotoFile, setNewWorkerPhotoFile] = useState<File | null>(null);
  const [newWorkerPhotoPreview, setNewWorkerPhotoPreview] = useState<string>("");
  const [addingWorker, setAddingWorker] = useState<boolean>(false);
  const [workerSuccess, setWorkerSuccess] = useState<string>("");
  const [workerError, setWorkerError] = useState<string>("");

  // Worker Editing State
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [editWorkerName, setEditWorkerName] = useState<string>("");
  const [editWorkerPhone, setEditWorkerPhone] = useState<string>("");
  const [editWorkerCategory, setEditWorkerCategory] = useState<string>("");
  const [editWorkerPhotoUrl, setEditWorkerPhotoUrl] = useState<string>("");
  const [editWorkerPhotoFile, setEditWorkerPhotoFile] = useState<File | null>(null);
  const [editWorkerPhotoPreview, setEditWorkerPhotoPreview] = useState<string>("");
  const [savingWorkerEdit, setSavingWorkerEdit] = useState<boolean>(false);

  // Offers & Coupons Form State
  const [newOfferTitle, setNewOfferTitle] = useState<string>("");
  const [newOfferCode, setNewOfferCode] = useState<string>("");
  const [newOfferDesc, setNewOfferDesc] = useState<string>("");
  const [newOfferDiscountType, setNewOfferDiscountType] = useState<"percent" | "flat">("flat");
  const [newOfferDiscount, setNewOfferDiscount] = useState<number>(100);
  const [newOfferIsFestival, setNewOfferIsFestival] = useState<boolean>(false);
  const [newOfferMinBookings, setNewOfferMinBookings] = useState<number>(0);
  const [addingOffer, setAddingOffer] = useState<boolean>(false);
  const [offerSuccess, setOfferSuccess] = useState<string>("");
  const [offerError, setOfferError] = useState<string>("");

  // Worker Assigning state
  const [assigningBookingId, setAssigningBookingId] = useState<string | null>(null);

  // --- REAL-TIME ADMIN NOTIFICATIONS & ALERTS ---
  const [latestNotification, setLatestNotification] = useState<Booking | null>(null);
  const [unreadBookingIds, setUnreadBookingIds] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [desktopNotifyPermission, setDesktopNotifyPermission] = useState<NotificationPermission>(() => {
    if (typeof Notification !== "undefined") return Notification.permission;
    return "default";
  });
  const knownBookingIdsRef = useRef<Set<string> | null>(null);
  
  // Create Category Inputs
  const [newCatName, setNewCatName] = useState<string>("");
  const [newCatDesc, setNewCatDesc] = useState<string>("");
  const [newCatSubcats, setNewCatSubcats] = useState<string>("");
  const [newCatImage, setNewCatImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [addingCat, setAddingCat] = useState<boolean>(false);
  const [subcatInputMap, setSubcatInputMap] = useState<Record<string, string>>({});
  const [updatingSubcats, setUpdatingSubcats] = useState<boolean>(false);
  
  // --- PRICE MANAGEMENT MODAL STATE ---
  interface PriceManageTask {
    id: string;
    name: string;
    minPrice: string;
    maxPrice: string;
  }
  const [editingPriceCat, setEditingPriceCat] = useState<Category | null>(null);
  const [priceManageTasks, setPriceManageTasks] = useState<PriceManageTask[]>([]);
  const [savingPrices, setSavingPrices] = useState<boolean>(false);
  
  // --- GUARDRAIL ALERTS ---
  const [coralAlert, setCoralAlert] = useState<string>(""); // Strict 30MB File constraint alert
  const [categorySuccess, setCategorySuccess] = useState<string>("");
  const [deleteError, setDeleteError] = useState<string>("");
  const [deleteSuccess, setDeleteSuccess] = useState<string>("");
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);

  // --- USER DETAILS PURGE STATES ---
  const [confirmPiiDeleteBooking, setConfirmPiiDeleteBooking] = useState<Booking | null>(null);
  const [deletingPii, setDeletingPii] = useState<boolean>(false);
  const [piiDeleteSuccess, setPiiDeleteSuccess] = useState<string>("");
  const [piiDeleteError, setPiiDeleteError] = useState<string>("");

  // --- GOOGLE MAPS LINK & NAVIGATION STATES ---
  const [copiedMapsId, setCopiedMapsId] = useState<string | null>(null);
  const [shareBooking, setShareBooking] = useState<Booking | null>(null);
  const [shareCopyFeedback, setShareCopyFeedback] = useState<boolean>(false);
  const [adminTab, setAdminTab] = useState<"active" | "all" | "history" | "workers" | "offers" | "categories">("active");

  useEffect(() => {
    onAdminTabChange?.(adminTab);
  }, [adminTab, onAdminTabChange]);

  const pushAdminNavState = (tabName: string, modalName?: string) => {
    try {
      const hashName = modalName ? `#admin-modal-${modalName}` : `#admin-${tabName}`;
      logNav("AdminPortal", "pushAdminNavState", { tabName, modalName, hashName });
      window.history.pushState({ fixHomeTab: "admin", section: tabName, modal: modalName }, "", hashName);
      notifyNativeBackState();
    } catch (e) {}
  };

  // Back-Stack Navigation Controller for Admin Portal
  const navigateAdminTab = (targetTab: "active" | "all" | "history" | "workers" | "offers" | "categories") => {
    const normTab = targetTab === "all" ? "active" : targetTab;
    logNav("AdminPortal", "navigateAdminTab", { targetTab, normTab, currentAdminTab: adminTab });
    if (normTab !== adminTab) {
      pushAdminNavState(normTab);
      setAdminTab(normTab);
    }
  };

  useEffect(() => {
    const syncAdminFromState = () => {
      const st = window.history.state || {};
      logNav("AdminPortal", "syncAdminFromState", { st, currentAdminTab: adminTab });
      if (st.fixHomeTab === "admin") {
        if (st.section) {
          setAdminTab(st.section as any);
        } else {
          setAdminTab("active");
        }
        if (st.modal !== "share") {
          setShareBooking(null);
        }
        if (st.modal !== "delete") {
          setConfirmPiiDeleteBooking(null);
        }
      }
    };

    syncAdminFromState();

    const handleAdminPopState = () => {
      logNav("AdminPortal", "popstate/hashchange fired in AdminPortal");
      syncAdminFromState();
    };

    window.addEventListener("popstate", handleAdminPopState);
    window.addEventListener("hashchange", handleAdminPopState);
    return () => {
      window.removeEventListener("popstate", handleAdminPopState);
      window.removeEventListener("hashchange", handleAdminPopState);
    };
  }, []);
  
  // Permanent History Search & Filters
  const [historySearchQuery, setHistorySearchQuery] = useState<string>("");
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<string>("all");
  const [statusNotice, setStatusNotice] = useState<string>("");
  const [nextRefreshCountdown, setNextRefreshCountdown] = useState<number>(30);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState<boolean>(false);

  const fetchBookingsRef = useRef<((authToken?: string, isSilent?: boolean) => Promise<void>) | null>(null);

  const getBookingMapsUrl = (b: Booking): string => {
    if (b.google_maps_url) return b.google_maps_url;
    if (b.latitude != null && b.longitude != null) {
      return `https://maps.google.com/?q=${b.latitude},${b.longitude}`;
    }
    if (b.address && b.address.trim()) {
      return `https://maps.google.com/?q=${encodeURIComponent(b.address.trim())}`;
    }
    return "";
  };

  const handleOpenMapsLink = (b: Booking) => {
    const url = getBookingMapsUrl(b);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopyMapsLink = (b: Booking) => {
    const url = getBookingMapsUrl(b);
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedMapsId(b.request_id);
      setTimeout(() => setCopiedMapsId(null), 2500);
    }).catch(() => {
      setCopiedMapsId(b.request_id);
      setTimeout(() => setCopiedMapsId(null), 2500);
    });
  };

  const handleShareMapsLink = async (b: Booking) => {
    const url = getBookingMapsUrl(b);
    if (!url) return;

    const shareData = {
      title: "FixHome Customer Location",
      text: `Customer Location for Booking #${b.request_id.slice(0, 8)} (${b.service_type}):`,
      url: url
    };

    if (navigator.share && typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // Fallback to custom share modal on rejection or non-support
      }
    }
    pushAdminNavState(adminTab, "share");
    setShareBooking(b);
  };

  // Helper to reliably retrieve current session token
  const getActiveToken = (): string => {
    return token || localStorage.getItem("fix_home_admin_token") || sessionStorage.getItem("fix_home_admin_token") || "";
  };

  // Play audio chime notification exclusively for admin
  const playAdminNotificationChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const playTone = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.35, startTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      playTone(587.33, now, 0.25); // D5
      playTone(880.00, now + 0.15, 0.45); // A5
    } catch (e) {
      console.error("Audio chime playback error:", e);
    }
  };

  const [adminNotifyBannerDismissed, setAdminNotifyBannerDismissed] = useState<boolean>(() => {
    return localStorage.getItem("fix_home_admin_notifications_dismissed") === "true";
  });

  const requestDesktopPermission = async () => {
    playAdminNotificationChime();

    if (typeof Notification !== "undefined") {
      try {
        if ("serviceWorker" in navigator) {
          try {
            await navigator.serviceWorker.register('/sw.js');
          } catch (swe) {}
        }
        const res = await Notification.requestPermission();
        setDesktopNotifyPermission(res);
      } catch (e) {
        console.error("Desktop notification permission error:", e);
      }
    }

    setAdminNotifyBannerDismissed(true);
    localStorage.setItem("fix_home_admin_notifications_dismissed", "true");
  };

  const triggerMobilePushNotification = async (title: string, body: string, tag?: string) => {
    if (typeof window === "undefined") return;
    if (typeof Notification === "undefined") return;

    let perm = Notification.permission;
    if (perm === "default") {
      try {
        perm = await Notification.requestPermission();
        setDesktopNotifyPermission(perm);
      } catch (e) {}
    }

    if (perm !== "granted") {
      console.warn("Notification permission not granted for Admin push:", perm);
      return;
    }

    const notificationOptions: NotificationOptions = {
      body,
      icon: "/fixhome_logo.jpg",
      badge: "/fixhome_logo.jpg",
      tag: tag || "fixhome-admin-push",
      vibrate: [500, 200, 500, 200, 500],
      requireInteraction: true,
      renotify: true,
      data: { url: "/" }
    } as any;

    // 1. Try Service Worker showNotification first (native mobile OS push notification bar & lock screen alert)
    if ("serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && "showNotification" in reg) {
          await reg.showNotification(title, notificationOptions);
          return;
        }
      } catch (e) {
        console.warn("SW showNotification failed:", e);
      }
    }

    // 2. Standard Web Notification API fallback
    try {
      new Notification(title, notificationOptions);
    } catch (e) {
      console.warn("Standard Notification constructor failed:", e);
    }
  };

  const notifyAdminOfBooking = (booking: Booking) => {
    // 1. Audio Chime
    if (soundEnabled) {
      playAdminNotificationChime();
    }

    // 2. Native Mobile Push Notification sent directly to Admin device
    triggerMobilePushNotification(
      "🚨 NEW SERVICE BOOKING RECEIVED!",
      `Service: ${booking.service_type.toUpperCase()}\nCustomer Phone: ${booking.mobile_number || "Logged"}\nLocation: ${booking.address || "Address specified"}`,
      "admin-booking-" + booking.request_id
    );

    // 3. Visual Banner Alert
    setLatestNotification(booking);

    // 4. Mark ID as unread
    setUnreadBookingIds((prev) => new Set(prev).add(booking.request_id));
  };

  // Keep fetchBookingsRef synced to latest fetchBookings function
  useEffect(() => {
    fetchBookingsRef.current = fetchBookings;
  });

  // Sync state, fetch data & setup live booking listeners when logged in with 30s auto-refresh ticker
  useEffect(() => {
    if (!isLoggedIn) return;

    const currentToken = getActiveToken();
    if (currentToken) {
      fetchBookings(currentToken);
      fetchCategories();
      fetchWorkers();
      fetchOffers();
    }

    // 1-second ticker for precise 30s auto-refresh countdown
    const countdownInterval = setInterval(() => {
      setNextRefreshCountdown((prev) => {
        if (prev <= 1) {
          fetchBookingsRef.current?.(undefined, true);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    // Instant local storage, custom event, and BroadcastChannel listeners for instant updates when booked
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "fix_home_all_bookings" || e.key === "fix_home_active_booking_id") {
        fetchBookingsRef.current?.(undefined, true);
        setNextRefreshCountdown(30);
      }
    };

    const handleCustomNewBooking = (e: any) => {
      if (e.detail) {
        notifyAdminOfBooking(e.detail);
        fetchBookingsRef.current?.(undefined, true);
        setNextRefreshCountdown(30);
      }
    };

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        bc = new BroadcastChannel("fix_home_channel");
        bc.onmessage = (event) => {
          if (event.data?.type === "NEW_BOOKING") {
            if (event.data.booking) {
              notifyAdminOfBooking(event.data.booking);
            }
            fetchBookingsRef.current?.(undefined, true);
            setNextRefreshCountdown(30);
          } else if (event.data?.type === "BOOKING_UPDATED") {
            fetchBookingsRef.current?.(undefined, true);
            setNextRefreshCountdown(30);
          }
        };
      } catch (e) {}
    }

    const handleWindowFocus = () => {
      fetchBookingsRef.current?.(undefined, true);
      setNextRefreshCountdown(30);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("fix_home_new_booking", handleCustomNewBooking);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      clearInterval(countdownInterval);
      if (bc) bc.close();
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("fix_home_new_booking", handleCustomNewBooking);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [isLoggedIn]);

  // 1-second ticker for login screen countdowns & auto-expiration handling
  useEffect(() => {
    if (isLoggedIn) return;
    const interval = setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);

      // Check tier 1 expiration (5 min timer completed)
      if (lockoutData.tier1LockUntil !== null && currentTime >= lockoutData.tier1LockUntil) {
        const updated: AdminLockoutData = {
          ...lockoutData,
          tier1LockUntil: null,
          hasCompletedTier1Lock: true,
          tier2Attempts: 0,
        };
        setLockoutData(updated);
        saveLockoutData(updated);
      }

      // Check tier 2 expiration (12 hours lock completed)
      if (lockoutData.tier2LockUntil !== null && currentTime >= lockoutData.tier2LockUntil) {
        const reset: AdminLockoutData = {
          tier1Attempts: 0,
          tier1LockUntil: null,
          hasCompletedTier1Lock: false,
          tier2Attempts: 0,
          tier2LockUntil: null,
        };
        setLockoutData(reset);
        saveLockoutData(reset);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoggedIn, lockoutData]);

  // --- ACTIONS ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    const currentTime = Date.now();

    // Check if currently locked out
    if (lockoutData.tier2LockUntil !== null && currentTime < lockoutData.tier2LockUntil) {
      const rem = formatTimeRemaining(lockoutData.tier2LockUntil - currentTime);
      setLoginError(`Admin Portal is locked for 12 hours due to repeated failed attempts. Time remaining: ${rem}`);
      return;
    }

    if (lockoutData.tier1LockUntil !== null && currentTime < lockoutData.tier1LockUntil) {
      const rem = formatTimeRemaining(lockoutData.tier1LockUntil - currentTime);
      setLoginError(`Admin Portal is locked for 5 minutes due to 5 failed attempts. Time remaining: ${rem}`);
      return;
    }

    setIsLoggingIn(true);

    const cleanPhone = loginPhone.trim();
    const cleanPassword = loginPassword.trim();

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile_number: cleanPhone, password: cleanPassword })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // RESET ALL LOCKOUT COUNTERS ON SUCCESSFUL AUTH
        const cleanLockout: AdminLockoutData = {
          tier1Attempts: 0,
          tier1LockUntil: null,
          hasCompletedTier1Lock: false,
          tier2Attempts: 0,
          tier2LockUntil: null,
        };
        setLockoutData(cleanLockout);
        saveLockoutData(cleanLockout);

        localStorage.setItem("fix_home_admin_token", data.token);
        localStorage.setItem("fix_home_admin_phone", data.admin.mobile_number);
        setToken(data.token);
        setAdminPhone(data.admin.mobile_number);
        setIsLoggedIn(true);
        setLoginPhone("");
        setLoginPassword("");
        fetchBookings(data.token);
        fetchCategories();
        fetchWorkers();
        fetchOffers();
      } else {
        // FAILED AUTH ATTEMPT
        let updated = { ...lockoutData };

        if (updated.hasCompletedTier1Lock) {
          // Tier 2: 3 attempts allowed after 5-min timer
          const newCount = updated.tier2Attempts + 1;
          if (newCount >= 3) {
            const lockUntil = Date.now() + 12 * 60 * 60 * 1000; // 12 hours
            updated = {
              ...updated,
              tier2Attempts: newCount,
              tier2LockUntil: lockUntil,
            };
            setLoginError(`3 failed attempts reached! Admin Portal is locked for 12 hours.`);
          } else {
            updated = {
              ...updated,
              tier2Attempts: newCount,
            };
            const left = 3 - newCount;
            setLoginError(`Invalid credentials. ${left} final attempt${left > 1 ? "s" : ""} remaining before 12-hour portal lock.`);
          }
        } else {
          // Tier 1: 5 attempts allowed initially
          const newCount = updated.tier1Attempts + 1;
          if (newCount >= 5) {
            const lockUntil = Date.now() + 5 * 60 * 1000; // 5 minutes
            updated = {
              ...updated,
              tier1Attempts: newCount,
              tier1LockUntil: lockUntil,
            };
            setLoginError(`5 consecutive failed attempts! Admin Portal locked for 5 minutes.`);
          } else {
            updated = {
              ...updated,
              tier1Attempts: newCount,
            };
            const left = 5 - newCount;
            setLoginError(`Invalid credentials. ${left} attempt${left > 1 ? "s" : ""} remaining before 5-minute security lock.`);
          }
        }

        setLockoutData(updated);
        saveLockoutData(updated);
      }
    } catch (err) {
      setLoginError("Failed to authenticate with server backend.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = (message?: string) => {
    localStorage.removeItem("fix_home_admin_token");
    localStorage.removeItem("fix_home_admin_phone");
    sessionStorage.removeItem("fix_home_admin_token");
    sessionStorage.removeItem("fix_home_admin_phone");
    setToken("");
    setAdminPhone("");
    setIsLoggedIn(false);
    if (message) {
      setLoginError(message);
    }
  };

  const fetchBookings = async (authToken?: string, isSilent = false) => {
    const tokenToUse = authToken || getActiveToken();
    if (!tokenToUse) {
      return;
    }

    if (!isSilent) {
      setLoadingBookings(true);
    }
    try {
      const res = await fetch("/api/bookings", {
        headers: { Authorization: `Bearer ${tokenToUse}` }
      });

      // Retrieve local backup bookings
      let localBookings: Booking[] = [];
      try {
        const rawLocal = localStorage.getItem("fix_home_all_bookings");
        if (rawLocal) localBookings = JSON.parse(rawLocal);
      } catch (e) {
        console.error("Failed to parse local bookings backup", e);
      }

      let merged: Booking[] = [];
      if (res.ok) {
        const serverData: Booking[] = await res.json();
        
        // Merge server bookings and local bookings by request_id (server data takes priority)
        const bookingMap = new Map<string, Booking>();
        localBookings.forEach((b) => bookingMap.set(b.request_id, b));
        serverData.forEach((b) => bookingMap.set(b.request_id, b));

        merged = Array.from(bookingMap.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setBookings(merged);
        localStorage.setItem("fix_home_all_bookings", JSON.stringify(merged));
      } else if (res.status === 401) {
        handleLogout("Session expired. Please log in again.");
        return;
      } else {
        // Use local backup if available
        if (localBookings.length > 0) {
          merged = localBookings.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          setBookings(merged);
        }
      }

      // Detect new bookings and alert admin
      if (merged.length > 0) {
        if (knownBookingIdsRef.current === null) {
          // Initial population on mount/login
          knownBookingIdsRef.current = new Set(merged.map((b) => b.request_id));
        } else {
          // Identify newly arrived bookings
          const newlyArrived = merged.filter((b) => !knownBookingIdsRef.current!.has(b.request_id));
          if (newlyArrived.length > 0) {
            newlyArrived.forEach((b) => {
              knownBookingIdsRef.current!.add(b.request_id);
              notifyAdminOfBooking(b);
            });
          }
        }
      }
    } catch (err) {
      console.error("Error fetching bookings:", err);
      // Fallback to local backup
      try {
        const rawLocal = localStorage.getItem("fix_home_all_bookings");
        if (rawLocal) setBookings(JSON.parse(rawLocal));
      } catch (e) {}
    } finally {
      if (!isSilent) {
        setLoadingBookings(false);
      }
    }
  };

  const fetchCategories = async () => {
    setLoadingCats(true);
    try {
      const res = await fetch("/api/categories");
      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setCategories(data);
        }
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
    } finally {
      setLoadingCats(false);
    }
  };

  const fetchWorkers = async () => {
    setLoadingWorkers(true);
    try {
      const res = await fetch("/api/workers");
      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setWorkers(data);
        }
      }
    } catch (err) {
      console.error("Error fetching workers:", err);
    } finally {
      setLoadingWorkers(false);
    }
  };

  const fetchOffers = async () => {
    setLoadingOffers(true);
    try {
      const res = await fetch("/api/offers");
      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setOffers(data);
          try {
            localStorage.setItem("fix_home_cached_offers", JSON.stringify(data));
            window.dispatchEvent(new Event("storage"));
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error("Error fetching offers:", err);
    } finally {
      setLoadingOffers(false);
    }
  };

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorkerError("");
    setWorkerSuccess("");

    if (!newWorkerName.trim() || !newWorkerPhone.trim() || !newWorkerCategory.trim()) {
      setWorkerError("Please enter worker name, phone number, and service category.");
      return;
    }

    setAddingWorker(true);
    try {
      const tokenToUse = getActiveToken();
      let res: Response;

      if (newWorkerPhotoFile) {
        const formData = new FormData();
        formData.append("name", newWorkerName.trim());
        formData.append("phone_number", newWorkerPhone.trim());
        formData.append("category", newWorkerCategory.trim());
        formData.append("photo", newWorkerPhotoFile);
        if (newWorkerPhoto.trim()) {
          formData.append("photo_url", newWorkerPhoto.trim());
        }

        res = await fetch("/api/workers", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenToUse}`
          },
          body: formData
        });
      } else {
        res = await fetch("/api/workers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenToUse}`
          },
          body: JSON.stringify({
            name: newWorkerName.trim(),
            phone_number: newWorkerPhone.trim(),
            category: newWorkerCategory.trim(),
            photo_url: newWorkerPhoto.trim() || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80"
          })
        });
      }

      if (res.ok) {
        setWorkerSuccess("Worker registered successfully!");
        setNewWorkerName("");
        setNewWorkerPhone("");
        setNewWorkerCategory("");
        setNewWorkerPhoto("");
        setNewWorkerPhotoFile(null);
        setNewWorkerPhotoPreview("");
        fetchWorkers();
        setTimeout(() => setWorkerSuccess(""), 3500);
      } else {
        const errData = await res.json();
        setWorkerError(errData.error || "Failed to register worker.");
      }
    } catch (err) {
      setWorkerError("Network error while adding worker.");
    } finally {
      setAddingWorker(false);
    }
  };

  const startEditWorker = (worker: Worker) => {
    setEditingWorkerId(worker.id);
    setEditWorkerName(worker.name || "");
    setEditWorkerPhone(worker.phone_number || "");
    setEditWorkerCategory(worker.category || "");
    setEditWorkerPhotoUrl(worker.photo_url || "");
    setEditWorkerPhotoFile(null);
    setEditWorkerPhotoPreview(worker.photo_url || "");
    setWorkerError("");
    setWorkerSuccess("");
  };

  const cancelEditWorker = () => {
    setEditingWorkerId(null);
    setEditWorkerName("");
    setEditWorkerPhone("");
    setEditWorkerCategory("");
    setEditWorkerPhotoUrl("");
    setEditWorkerPhotoFile(null);
    setEditWorkerPhotoPreview("");
  };

  const handleSaveWorkerEdit = async (workerId: string) => {
    if (!editWorkerName.trim() || !editWorkerPhone.trim() || !editWorkerCategory.trim()) {
      setWorkerError("Worker name, phone number, and service category are required.");
      return;
    }
    setSavingWorkerEdit(true);
    setWorkerError("");
    setWorkerSuccess("");

    try {
      const tokenToUse = getActiveToken();
      let res: Response;

      if (editWorkerPhotoFile) {
        const formData = new FormData();
        formData.append("name", editWorkerName.trim());
        formData.append("phone_number", editWorkerPhone.trim());
        formData.append("category", editWorkerCategory.trim());
        formData.append("photo", editWorkerPhotoFile);
        if (editWorkerPhotoUrl.trim()) {
          formData.append("photo_url", editWorkerPhotoUrl.trim());
        }

        res = await fetch(`/api/workers/${workerId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${tokenToUse}`
          },
          body: formData
        });
      } else {
        res = await fetch(`/api/workers/${workerId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenToUse}`
          },
          body: JSON.stringify({
            name: editWorkerName.trim(),
            phone_number: editWorkerPhone.trim(),
            category: editWorkerCategory.trim(),
            photo_url: editWorkerPhotoUrl.trim()
          })
        });
      }

      const data = await res.json();
      if (res.ok && data.success) {
        setWorkerSuccess(`Worker "${data.worker.name}" updated successfully.`);
        setEditingWorkerId(null);
        setEditWorkerPhotoFile(null);
        setEditWorkerPhotoPreview("");
        fetchWorkers();
        setTimeout(() => setWorkerSuccess(""), 3500);
      } else {
        setWorkerError(data.error || "Failed to update worker details.");
      }
    } catch (err) {
      setWorkerError("Network error while updating worker details.");
    } finally {
      setSavingWorkerEdit(false);
    }
  };

  const handleDeleteWorker = async (workerId: string) => {
    if (!window.confirm("Are you sure you want to delete this worker?")) return;
    try {
      const tokenToUse = getActiveToken();
      const res = await fetch(`/api/workers/${workerId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenToUse}` }
      });
      if (res.ok) {
        fetchWorkers();
      }
    } catch (err) {
      console.error("Error deleting worker:", err);
    }
  };

  const handleAssignWorker = async (requestId: string, workerId: string) => {
    setAssigningBookingId(requestId);
    try {
      const tokenToUse = getActiveToken();
      const res = await fetch(`/api/bookings/${requestId}/assign-worker`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenToUse}`
        },
        body: JSON.stringify({ worker_id: workerId || null })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.booking) {
          // Broadcast status update across tabs
          try {
            if (typeof BroadcastChannel !== "undefined") {
              const bc = new BroadcastChannel("fix_home_channel");
              bc.postMessage({
                type: "WORKER_ASSIGNED",
                bookingId: requestId,
                status: data.booking.status,
                assigned_worker_name: data.booking.assigned_worker_name,
                assigned_worker_phone: data.booking.assigned_worker_phone,
                service_type: data.booking.service_type,
                booking: data.booking
              });
              bc.close();
            }
          } catch (e) {}
          window.dispatchEvent(new CustomEvent("fix_home_status_updated", { detail: data.booking }));
        }
        await fetchBookings(undefined, true);
        await fetchWorkers();
      }
    } catch (err) {
      console.error("Error assigning worker:", err);
    } finally {
      setAssigningBookingId(null);
    }
  };

  const handleAddOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setOfferError("");
    setOfferSuccess("");

    if (!newOfferTitle.trim() || !newOfferDesc.trim()) {
      setOfferError("Please enter coupon title and description.");
      return;
    }

    const finalCode = (newOfferCode.trim() || `OFFER${newOfferDiscount}`).toUpperCase();

    setAddingOffer(true);
    try {
      const tokenToUse = getActiveToken();
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenToUse}`
        },
        body: JSON.stringify({
          title: newOfferTitle.trim(),
          code: finalCode,
          description: newOfferDesc.trim(),
          discount_type: newOfferDiscountType,
          discount_value: Number(newOfferDiscount),
          discount_percentage: Number(newOfferDiscount),
          is_festival_offer: Boolean(newOfferIsFestival),
          min_bookings_required: Number(newOfferMinBookings)
        })
      });
      if (res.ok) {
        setOfferSuccess("Coupon created successfully and published to user portal!");
        setNewOfferTitle("");
        setNewOfferCode("");
        setNewOfferDesc("");
        setNewOfferDiscount(100);
        setNewOfferDiscountType("flat");
        setNewOfferIsFestival(false);
        setNewOfferMinBookings(0);
        fetchOffers();
        setTimeout(() => setOfferSuccess(""), 3500);
      } else {
        const errData = await res.json();
        setOfferError(errData.error || "Failed to create coupon.");
      }
    } catch (err) {
      setOfferError("Network error creating coupon.");
    } finally {
      setAddingOffer(false);
    }
  };

  const handleToggleOffer = async (offerId: string, currentActive: boolean) => {
    try {
      const tokenToUse = getActiveToken();
      const res = await fetch(`/api/offers/${offerId}/toggle`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenToUse}`
        },
        body: JSON.stringify({ is_active: !currentActive })
      });
      if (res.ok) {
        fetchOffers();
      }
    } catch (err) {
      console.error("Error toggling offer:", err);
    }
  };

  const handleDeleteOffer = async (offerId: string) => {
    if (!window.confirm("Are you sure you want to delete this offer?")) return;
    try {
      const tokenToUse = getActiveToken();
      const res = await fetch(`/api/offers/${offerId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenToUse}` }
      });
      if (res.ok) {
        fetchOffers();
      }
    } catch (err) {
      console.error("Error deleting offer:", err);
    }
  };

  const handleUpdateStatus = async (bookingId: string, newStatus: string) => {
    if (newStatus === "Completed") {
      setStatusNotice(`Dispatch #${bookingId.slice(0, 8)} marked as Completed and transferred to Permanent Booking History.`);
      setTimeout(() => setStatusNotice(""), 5000);
    }

    // 1. Optimistic Update immediately in local state and localStorage
    setBookings((prev) => {
      const updatedList = prev.map((b) => {
        if (b.request_id === bookingId) {
          if (newStatus === "Completed") {
            return {
              ...b,
              status: "Completed" as const,
              mobile_number: null,
              address: null,
              latitude: null,
              longitude: null,
              google_maps_url: null,
              landmark: null,
              additional_notes: null,
              is_personal_data_deleted: true,
              updated_at: new Date().toISOString()
            };
          }
          return { ...b, status: newStatus as any, updated_at: new Date().toISOString() };
        }
        return b;
      });

      try {
        localStorage.setItem("fix_home_all_bookings", JSON.stringify(updatedList));
      } catch (e) {}

      return updatedList;
    });

    const targetBooking = bookings.find((b) => b.request_id === bookingId);
    const serviceType = targetBooking?.service_type || "Home Service";
    const workerName = targetBooking?.assigned_worker_name;

    // 2. Broadcast status update across tabs for real-time tracking
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("fix_home_channel");
        bc.postMessage({
          type: "STATUS_UPDATED",
          bookingId,
          status: newStatus,
          service_type: serviceType,
          assigned_worker_name: workerName,
          booking: targetBooking ? { ...targetBooking, status: newStatus } : null
        });
        bc.close();
      }
    } catch (e) {}

    window.dispatchEvent(new CustomEvent("fix_home_status_updated", {
      detail: targetBooking ? { ...targetBooking, status: newStatus } : { request_id: bookingId, status: newStatus, service_type: serviceType }
    }));

    const currentToken = getActiveToken();
    if (!currentToken) {
      return;
    }

    try {
      const res = await fetch(`/api/bookings/${bookingId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        const data = await res.json();
        const serverUpdatedBooking: Booking | undefined = data.booking;

        if (serverUpdatedBooking) {
          setBookings((prev) => {
            const updatedList = prev.map((b) => (b.request_id === bookingId ? serverUpdatedBooking : b));
            try {
              localStorage.setItem("fix_home_all_bookings", JSON.stringify(updatedList));
            } catch (e) {}
            return updatedList;
          });
        }
      } else if (res.status === 401) {
        handleLogout("Session expired. Please log in again.");
      }
    } catch (err) {
      console.error("Error updating booking status on server:", err);
    }
  };

  const executeDeleteUserDetails = async (bookingId: string) => {
    setPiiDeleteError("");
    setPiiDeleteSuccess("");
    setDeletingPii(true);

    const currentToken = getActiveToken();

    try {
      let updatedBookingData: Booking | null = null;

      if (currentToken) {
        const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/pii`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${currentToken}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (data.booking) {
            updatedBookingData = data.booking;
          }
        } else if (res.status === 401) {
          handleLogout("Session expired. Please log in again.");
          setDeletingPii(false);
          setConfirmPiiDeleteBooking(null);
          return;
        }
      }

      // Update React state and sync with local storage backups for instant responsiveness
      const newBookings = bookings.map((b) => {
        if (b.request_id === bookingId) {
          if (updatedBookingData) {
            return updatedBookingData;
          }
          return {
            ...b,
            mobile_number: null,
            address: null,
            latitude: null,
            longitude: null,
            landmark: null,
            additional_notes: null,
            is_personal_data_deleted: true,
            updated_at: new Date().toISOString()
          };
        }
        return b;
      });

      setBookings(newBookings);

      // Persist into localStorage & notify open windows
      try {
        localStorage.setItem("fix_home_all_bookings", JSON.stringify(newBookings));
        const activeRaw = localStorage.getItem("fix_home_active_booking");
        if (activeRaw) {
          const activeObj = JSON.parse(activeRaw);
          if (activeObj.request_id === bookingId) {
            localStorage.setItem(
              "fix_home_active_booking",
              JSON.stringify({
                ...activeObj,
                mobile_number: null,
                address: null,
                latitude: null,
                longitude: null,
                landmark: null,
                additional_notes: null,
                is_personal_data_deleted: true,
                updated_at: new Date().toISOString()
              })
            );
          }
        }
        window.dispatchEvent(new Event("storage"));
      } catch (e) {}

      setPiiDeleteSuccess(`Customer user details deleted for request #${bookingId}. Service log permanently retained.`);
      setTimeout(() => setPiiDeleteSuccess(""), 4000);
    } catch (err) {
      console.error("Error deleting customer user details:", err);
      setPiiDeleteError("Failed to delete customer user details. Please try again.");
    } finally {
      setDeletingPii(false);
      setConfirmPiiDeleteBooking(null);
    }
  };

  // CATEGORY FILE PICKER CONTROLLER WITH 30MB IMAGE VALIDATION
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCoralAlert("");
    setCategorySuccess("");
    const file = e.target.files?.[0];
    if (!file) return;

    // CRITICAL 30MB LIMIT VALIDATION
    const THIRTY_MB = 30 * 1024 * 1024;
    if (file.size > THIRTY_MB) {
      // Throw Soft Coral Alert instantly and reset inputs
      setCoralAlert(
        "CRITICAL FILE CONSTRAINT EXCEEDED: The selected image file is " +
        (file.size / (1024 * 1024)).toFixed(2) +
        "MB. To prevent transport timeouts, uploads exceeding exactly 30MB are strictly blocked by system policy."
      );
      setNewCatImage(null);
      setImagePreview("");
      e.target.value = ""; // Clear file selector input
      return;
    }

    setNewCatImage(file);
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAddCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCoralAlert("");
    setCategorySuccess("");

    if (!newCatName.trim() || !newCatDesc.trim()) {
      setCoralAlert("Service Name and Description text are required.");
      return;
    }

    if (!newCatImage) {
      setCoralAlert("Please select a device gallery image for this service.");
      return;
    }

    setAddingCat(true);
    const formData = new FormData();
    formData.append("name", newCatName);
    formData.append("description", newCatDesc);
    formData.append("image", newCatImage);

    const parsedSubcats = newCatSubcats
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parsedSubcats.length > 0) {
      formData.append("subcategories", JSON.stringify(parsedSubcats));
    }

    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setCategorySuccess(`Service category "${newCatName}" added successfully.`);
        setNewCatName("");
        setNewCatDesc("");
        setNewCatSubcats("");
        setNewCatImage(null);
        setImagePreview("");
        fetchCategories(); // Refresh active services
      } else {
        setCoralAlert(data.error || "Failed to create category on server.");
      }
    } catch (err) {
      setCoralAlert("Network failure during category upload process.");
    } finally {
      setAddingCat(false);
    }
  };

  const handleUpdateSubcategories = async (catId: string, updatedSubcategories: string[]) => {
    setCategorySuccess("");
    setCoralAlert("");
    setUpdatingSubcats(true);
    try {
      const res = await fetch(`/api/categories/${catId}/subcategories`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ subcategories: updatedSubcategories })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCategories((prev) =>
          prev.map((c) => (c.id === catId ? { ...c, subcategories: data.category.subcategories } : c))
        );
        setCategorySuccess("Subcategories updated successfully.");
      } else {
        setCoralAlert(data.error || "Failed to update subcategories.");
      }
    } catch (err) {
      setCoralAlert("Network failure while updating subcategories.");
    } finally {
      setUpdatingSubcats(false);
    }
  };

  const handleAddSubcategoryToCat = (catId: string) => {
    const text = (subcatInputMap[catId] || "").trim();
    if (!text) return;
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    const currentList = cat.subcategories || [];
    if (currentList.includes(text)) {
      setSubcatInputMap((prev) => ({ ...prev, [catId]: "" }));
      return;
    }
    const newList = [...currentList, text];
    handleUpdateSubcategories(catId, newList);
    setSubcatInputMap((prev) => ({ ...prev, [catId]: "" }));
  };

  const handleRemoveSubcategoryFromCat = (catId: string, subcatToRemove: string) => {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    const newList = (cat.subcategories || []).filter((s) => s !== subcatToRemove);
    handleUpdateSubcategories(catId, newList);
  };

  const openPriceManager = (cat: Category) => {
    setEditingPriceCat(cat);
    const parsed = (cat.subcategories || []).map((subRaw, index) => {
      const item = parseSubcategoryItem(subRaw);
      const minP = item.minPrice > 0 ? String(item.minPrice) : (item.price > 0 ? String(item.price) : "199");
      const maxP = item.maxPrice > 0 ? String(item.maxPrice) : (item.minPrice > 0 ? String(item.minPrice) : (item.price > 0 ? String(item.price) : "299"));
      return {
        id: `pm_${index}_${Date.now()}`,
        name: item.name || "Task",
        minPrice: minP,
        maxPrice: maxP
      };
    });
    setPriceManageTasks(parsed.length > 0 ? parsed : [
      { id: `pm_0_${Date.now()}`, name: "General Repairs / Inspection", minPrice: "199", maxPrice: "299" }
    ]);
  };

  const handleSavePriceManagement = async () => {
    if (!editingPriceCat) return;
    setSavingPrices(true);
    setCoralAlert("");
    try {
      const formattedSubcategories = priceManageTasks.map((task) => {
        const name = task.name.trim();
        const minP = parseInt(task.minPrice, 10) || 0;
        const maxP = parseInt(task.maxPrice, 10) || 0;
        if (!name) return "";
        if (minP > 0 && maxP > minP) {
          return `${name} - ₹${minP} - ₹${maxP}`;
        } else if (minP > 0) {
          return `${name} - ₹${minP}`;
        }
        return name;
      }).filter(Boolean);

      await handleUpdateSubcategories(editingPriceCat.id, formattedSubcategories);
      setEditingPriceCat(null);
      setCategorySuccess(`Price rates and task ranges updated successfully for ${editingPriceCat.name}.`);
    } catch (err) {
      setCoralAlert("Failed to save price rates.");
    } finally {
      setSavingPrices(false);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    setDeleteError("");
    setDeleteSuccess("");

    try {
      const res = await fetch(`/api/categories/${catId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setCategories((prev) => prev.filter((cat) => cat.id !== catId));
        setDeleteSuccess("Service category deleted successfully from the customer portal.");
        setDeletingCatId(null);
      } else if (res.status === 401) {
        handleLogout("Session expired. Please log in again.");
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error || "Failed to delete category on backend.");
        setDeletingCatId(null);
      }
    } catch (err) {
      console.error("Error deleting category:", err);
      setDeleteError("Network failure while deleting service category.");
      setDeletingCatId(null);
    }
  };

  // --- RENDER PORTALS ---

  // LOGIN PAGE (SECURE GATEWAY)
  if (!isLoggedIn) {
    const isTier2Locked = lockoutData.tier2LockUntil !== null && now < lockoutData.tier2LockUntil;
    const tier2RemainingMs = isTier2Locked ? lockoutData.tier2LockUntil! - now : 0;

    const isTier1Locked = lockoutData.tier1LockUntil !== null && now < lockoutData.tier1LockUntil;
    const tier1RemainingMs = isTier1Locked ? lockoutData.tier1LockUntil! - now : 0;

    const isCurrentlyLocked = isTier1Locked || isTier2Locked;

    return (
      <div id="admin-login" className="flex-1 flex flex-col justify-center items-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-slate-100 p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors ${
              isTier2Locked 
                ? "bg-rose-950 text-rose-400 ring-2 ring-rose-500/50" 
                : isTier1Locked 
                ? "bg-amber-950 text-amber-400 ring-2 ring-amber-500/50"
                : "bg-slate-900 text-[#e2f1e7]"
            }`}>
              {isTier2Locked ? (
                <ShieldX size={28} className="text-rose-500 animate-pulse" />
              ) : isTier1Locked ? (
                <Timer size={28} className="text-amber-400 animate-pulse" />
              ) : (
                <Lock size={28} className="text-[#65a30d]" />
              )}
            </div>

            <h2 className="text-xl font-bold text-[#1e293b]">
              {isTier2Locked ? "Portal Locked (12 Hours)" : isTier1Locked ? "Security Cooldown (5 Mins)" : "Admin Gateway Portal"}
            </h2>
            <p className="text-xs text-slate-400">
              {isTier2Locked 
                ? "Access suspended due to repeated failed login attempts." 
                : isTier1Locked 
                ? "Temporary security pause in effect." 
                : "Restricted zone. Administrative access token required."}
            </p>
          </div>

          {/* 12 HOUR LOCKOUT COUNTDOWN DISPLAY */}
          {isTier2Locked && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 space-y-2 text-center shadow-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-600 block">
                12-Hour Critical Lockout Active
              </span>
              <div className="flex items-center justify-center gap-2 text-2xl font-black font-mono text-rose-700 bg-white/80 py-2.5 px-4 rounded-xl border border-rose-200">
                <Timer size={22} className="text-rose-600 animate-pulse shrink-0" />
                <span>{formatTimeRemaining(tier2RemainingMs)}</span>
              </div>
              <p className="text-[11px] text-rose-700 leading-relaxed font-medium">
                Maximum security attempts exceeded (3 failed logins post 5-minute cooldown). Portal access is strictly locked.
              </p>
            </div>
          )}

          {/* 5 MINUTE LOCKOUT COUNTDOWN DISPLAY */}
          {isTier1Locked && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 space-y-2 text-center shadow-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-700 block">
                5-Minute Security Pause
              </span>
              <div className="flex items-center justify-center gap-2 text-2xl font-black font-mono text-amber-800 bg-white/80 py-2.5 px-4 rounded-xl border border-amber-200">
                <Timer size={22} className="text-amber-600 animate-pulse shrink-0" />
                <span>{formatTimeRemaining(tier1RemainingMs)}</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                5 consecutive failed attempts detected. Please wait for the countdown timer to finish before retrying.
              </p>
            </div>
          )}

          {/* TIER 2 UNLOCKED STATUS BADGE */}
          {!isCurrentlyLocked && lockoutData.hasCompletedTier1Lock && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold flex items-center gap-2.5">
              <ShieldAlert size={16} className="text-amber-600 shrink-0" />
              <div className="text-[11px] leading-tight">
                <span className="font-bold block text-amber-800">Final Security Tier Active</span>
                <span>You have <strong>{3 - lockoutData.tier2Attempts}</strong> of 3 attempt(s) remaining before a 12-hour portal lockout.</span>
              </div>
            </div>
          )}

          {/* TIER 1 REMAINING ATTEMPTS BADGE */}
          {!isCurrentlyLocked && !lockoutData.hasCompletedTier1Lock && lockoutData.tier1Attempts > 0 && (
            <div className="p-2.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-[11px] font-medium flex items-center justify-between">
              <span className="text-slate-500">Tier 1 Security Status:</span>
              <span className="font-bold text-[#65a30d]">
                {5 - lockoutData.tier1Attempts} / 5 attempts left
              </span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Admin Mobile Number
              </label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-3.5 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder=""
                  disabled={isCurrentlyLocked || isLoggingIn}
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-3 pl-9 pr-4 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Security Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder=""
                  disabled={isCurrentlyLocked || isLoggingIn}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-3 pl-4 pr-10 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isCurrentlyLocked || isLoggingIn}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  title={showPassword ? "Hide Password" : "Show Password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {loginError && !isCurrentlyLocked && (
              <div className="p-3.5 bg-[#fff1f2] border border-rose-100 text-rose-600 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isCurrentlyLocked || isLoggingIn}
              className={`w-full py-3 font-bold rounded-xl text-xs tracking-wider uppercase shadow-md transition-all flex items-center justify-center gap-2 ${
                isCurrentlyLocked
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                  : "bg-[#65a30d] hover:bg-[#52840a] disabled:bg-slate-300 text-white active:scale-[0.99] cursor-pointer"
              }`}
            >
              {isCurrentlyLocked
                ? isTier2Locked ? "Portal Locked (12 Hours)" : "Portal Locked (5 Minutes)"
                : isLoggingIn
                ? "Authorizing..."
                : lockoutData.hasCompletedTier1Lock
                ? `Authenticate Admin (${3 - lockoutData.tier2Attempts} Left)`
                : "Authenticate Admin"}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-slate-100">
            <span className="text-[10px] text-slate-400 block">
              Authorized credentials locked to single hardcoded administrator.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // LOGGED IN DASHBOARD
  const activeBookings = bookings.filter((b) => b.status !== "Completed");
  const historyBookings = bookings.filter((b) => b.status === "Completed");

  const filteredHistory = historyBookings.filter((b) => {
    const query = historySearchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      b.request_id.toLowerCase().includes(query) ||
      b.service_type.toLowerCase().includes(query) ||
      (b.assigned_worker_name || "").toLowerCase().includes(query) ||
      (b.mobile_number || "").includes(query) ||
      (b.customer_user_phone || "").includes(query);

    const matchesCat =
      historyCategoryFilter === "all" ||
      b.service_type.toLowerCase().includes(historyCategoryFilter.toLowerCase());

    return matchesSearch && matchesCat;
  });

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto">
      {/* Header bar */}
      <div className="bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-2.5 text-left">
          <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-xs border border-slate-200 shrink-0 bg-slate-900">
            <img src={FIXHOME_LOGO} alt="FixHome Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-[#1e293b] flex items-center gap-1.5">
              <span>FixHome</span>
              <span className="text-xs text-slate-400 font-normal">| Admin Console</span>
            </h2>
            <p className="text-[10px] text-[#65a30d] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#65a30d] animate-ping" />
              Connected: {adminPhone}
            </p>
          </div>
        </div>

        {/* Real-time Notification Controls */}
        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all ${
              soundEnabled
                ? "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
            }`}
            title={soundEnabled ? "Audio Chime Enabled" : "Audio Chime Muted"}
          >
            {soundEnabled ? <Volume2 size={16} className="text-[#65a30d]" /> : <VolumeX size={16} />}
          </button>

          {/* Desktop Push Notifications Toggle */}
          <button
            onClick={requestDesktopPermission}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all ${
              desktopNotifyPermission === "granted"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
            }`}
            title={
              desktopNotifyPermission === "granted"
                ? "Desktop Push Alerts Active"
                : "Click to enable Desktop Push Alerts"
            }
          >
            <BellRing size={16} className={desktopNotifyPermission === "granted" ? "text-[#65a30d]" : "text-amber-600 animate-bounce"} />
          </button>

          {/* Unread Badge Indicator */}
          <div className="relative">
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-slate-600">
              <Bell size={16} />
            </div>
            {unreadBookingIds.size > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center animate-pulse shadow-sm">
                {unreadBookingIds.size}
              </span>
            )}
          </div>

          <button
            onClick={() => handleLogout()}
            className="p-2 bg-slate-50 hover:bg-[#fff1f2] text-slate-500 hover:text-red-600 rounded-xl transition-all border border-slate-200 ml-1"
            title="Sign out of Admin Session"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs: Active Dispatches | Permanent History | Workers | Offers | Categories */}
      <div className="bg-white border-b border-slate-200 px-5 py-2.5 flex items-center gap-2 overflow-x-auto text-xs font-bold sticky top-[69px] z-30 shadow-2xs">
        <button
          type="button"
          onClick={() => navigateAdminTab("active")}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            adminTab === "active" || adminTab === "all"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Clock size={14} className="text-[#65a30d]" />
          <span>Active Dispatches ({activeBookings.length})</span>
        </button>

        <button
          type="button"
          onClick={() => navigateAdminTab("history")}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            adminTab === "history"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <History size={14} className="text-emerald-400" />
          <span>Booking History ({historyBookings.length})</span>
        </button>

        <button
          type="button"
          onClick={() => navigateAdminTab("workers")}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            adminTab === "workers"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Users size={14} />
          <span>Workers Details ({workers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => navigateAdminTab("offers")}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            adminTab === "offers"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Tag size={14} />
          <span>Offers & Season ({offers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => navigateAdminTab("categories")}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            adminTab === "categories"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Wrench size={14} />
          <span>Manage Categories ({categories.length})</span>
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* NATIVE OS MOBILE PUSH NOTIFICATION PERMISSION BANNER */}
        {desktopNotifyPermission !== "granted" && !adminNotifyBannerDismissed && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 rounded-2xl p-4 shadow-xl border border-amber-400 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 bg-slate-950/10 rounded-xl flex items-center justify-center shrink-0">
                <BellRing size={22} className="text-slate-950 animate-bounce" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-950">
                  ALLOW NOTIFICATIONS
                </h4>
                <p className="text-xs font-bold text-slate-900 mt-0.5 leading-snug">
                  Allow notifications to receive instant sound alerts & lock-screen push notifications whenever a customer books a service!
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={requestDesktopPermission}
                className="bg-slate-950 text-white hover:bg-black text-xs font-black px-4 py-2.5 rounded-xl shrink-0 shadow-md transition-all cursor-pointer border border-slate-800"
              >
                Allow Notifications
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminNotifyBannerDismissed(true);
                  localStorage.setItem("fix_home_admin_notifications_dismissed", "true");
                }}
                className="text-slate-950 hover:bg-amber-600/30 p-2 rounded-xl transition-colors cursor-pointer shrink-0"
                title="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* FLOATING REAL-TIME NEW BOOKING NOTIFICATION BANNER */}
        {latestNotification && (
          <div className="bg-emerald-600 text-white rounded-2xl p-4 shadow-xl border border-emerald-500 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-start gap-3 text-left">
              <div className="w-9 h-9 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-white shrink-0 mt-0.5">
                <BellRing size={20} className="animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black tracking-wider uppercase bg-white/20 px-2 py-0.5 rounded-full">
                    NEW BOOKING RECEIVED
                  </span>
                  <span className="text-[10px] text-emerald-100 font-mono">
                    {new Date(latestNotification.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm font-bold mt-1">
                  Service: <span className="underline">{latestNotification.service_type}</span>
                </p>
                <p className="text-xs text-emerald-100 font-medium mt-0.5">
                  Customer Phone: <strong className="text-white select-all">{latestNotification.mobile_number || "Logged"}</strong>
                </p>
                {latestNotification.address && (
                  <p className="text-[11px] text-emerald-100/90 truncate max-w-xs mt-0.5">
                    Location: {latestNotification.address}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setLatestNotification(null)}
              className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shrink-0 border border-white/20"
            >
              Acknowledge
            </button>
          </div>
        )}

        {/* REAL-TIME SENTINEL WATERMARK */}
        <div className="bg-slate-900 text-slate-300 rounded-2xl p-4 flex items-center justify-between text-xs shadow-md border border-slate-800">
          <div className="flex items-center gap-2.5 text-left">
            <BellRing size={16} className="text-[#65a30d] animate-pulse" />
            <div>
              <span className="font-semibold block text-white text-[11px]">Admin Booking Alert Sentinel</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Live audio chime & push alerts sent exclusively to admin console</span>
            </div>
          </div>
          <span className="bg-slate-800 text-[#e2f1e7] border border-slate-700 px-2.5 py-1 rounded-lg text-[9px] font-bold font-mono">
            LIVE MONITORING
          </span>
        </div>

        {/* SECTION 1: BOOKING DISPATCH REQUESTS (ACTIVE DISPATCHES TAB) */}
        {(adminTab === "active" || adminTab === "all") && (
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-left">
              <h3 className="text-sm font-bold text-[#1e293b] tracking-tight flex items-center gap-2">
                <Clock size={16} className="text-[#65a30d]" />
                <span>Active Dispatches ({activeBookings.length})</span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Dispatches are removed from this list as soon as marked Completed</p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-emerald-50 text-[#52840a] font-bold px-2.5 py-1 rounded-xl border border-emerald-200/80 flex items-center gap-1.5 shadow-2xs font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#65a30d] animate-pulse" />
                <span>Auto-refreshing in {nextRefreshCountdown}s</span>
              </span>

              <button
                type="button"
                onClick={() => {
                  fetchBookings();
                  setNextRefreshCountdown(30);
                }}
                disabled={loadingBookings}
                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-700 hover:text-slate-900 border border-slate-200 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                title="Refresh dispatch data manually now"
              >
                <RefreshCw size={12} className={loadingBookings ? "animate-spin text-[#65a30d]" : "text-slate-500"} />
                <span className="hidden sm:inline">Refresh Now</span>
              </button>
            </div>
          </div>

          {statusNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-[#52840a] font-bold text-xs rounded-2xl flex items-center justify-between shadow-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#65a30d] shrink-0" />
                <span>{statusNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => navigateAdminTab("history")}
                className="text-[10px] font-extrabold bg-[#65a30d] text-white px-2.5 py-1 rounded-lg hover:bg-[#52840a] transition-all cursor-pointer shrink-0"
              >
                View History →
              </button>
            </div>
          )}

          {piiDeleteSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{piiDeleteSuccess}</span>
            </div>
          )}

          {piiDeleteError && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{piiDeleteError}</span>
            </div>
          )}

          {loadingBookings ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1.5 w-1/2">
                      <Skeleton className="h-4 w-3/4 rounded-full" />
                      <Skeleton className="h-2.5 w-1/3 rounded" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-md" />
                  </div>
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ))}
            </div>
          ) : activeBookings.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-300 rounded-3xl p-6 space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-[#65a30d] rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">No Active Dispatches Pending</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                All dispatches have been resolved or completed. Dispatches marked as 'Completed' are automatically deleted from active view and stored in the Permanent History Log.
              </p>
              <button
                type="button"
                onClick={() => navigateAdminTab("history")}
                className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
              >
                <History size={14} className="text-emerald-400" />
                <span>View Permanent Booking History ({historyBookings.length}) →</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {activeBookings.map((booking) => {
                const isUnread = unreadBookingIds.has(booking.request_id);
                return (
                  <div 
                    key={booking.request_id}
                    onClick={() => {
                      if (isUnread) {
                        setUnreadBookingIds((prev) => {
                          const next = new Set(prev);
                          next.delete(booking.request_id);
                          return next;
                        });
                      }
                    }}
                    className={`border rounded-2xl p-4 text-left transition-all relative ${
                      isUnread 
                        ? "bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-200 shadow-md" 
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {/* Unread New Badge Tag */}
                    {isUnread && (
                      <div className="mb-2 inline-flex items-center gap-1 bg-emerald-600 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                        <BellRing size={10} /> NEW BOOKING REQUEST
                      </div>
                    )}

                    {/* Service badge & Time info */}
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex flex-wrap gap-1">
                          {booking.service_type.split(",").map((st, idx) => (
                            <span key={idx} className="inline-block bg-[#e2f1e7] text-[#65a30d] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border border-emerald-200">
                              {st.trim()}
                            </span>
                          ))}
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono mt-1">
                          Placed: {new Date(booking.created_at).toLocaleString()}
                        </div>
                      </div>
                    
                    {/* Status badge and single tap slider action */}
                    <div className="flex flex-col items-end gap-1">
                      <select
                        value={booking.status}
                        onChange={(e) => handleUpdateStatus(booking.request_id, e.target.value)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-md outline-hidden border ${
                          booking.status === "Pending" ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
                          booking.status === "Assigned" ? "bg-blue-100 text-blue-800 border-blue-200" :
                          booking.status === "In Progress" ? "bg-purple-100 text-purple-800 border-purple-200" :
                          "bg-emerald-100 text-emerald-800 border-emerald-200"
                        }`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Assigned">Assigned</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  </div>

                  {/* CUSTOMER DETAILS INTERFACE */}
                  <div className="mt-3.5 bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2 text-xs w-full max-w-full min-w-0 overflow-hidden">
                    {booking.is_personal_data_deleted && (
                      <div className="bg-amber-50 text-amber-800 border border-amber-200/80 px-2.5 py-1 rounded-lg text-[10px] font-extrabold flex items-center justify-between">
                        <span>User details auto-deleted after 6 hrs</span>
                        <span className="font-mono text-[9px] uppercase opacity-75">Service Record Saved</span>
                      </div>
                    )}

                    {/* WORKER ASSIGNMENT CONTROL */}
                    <div className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-2 text-left my-2 shadow-2xs w-full max-w-full min-w-0 overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-1.5 min-w-0">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800 min-w-0">
                          <UserCheck size={14} className="text-[#65a30d] shrink-0" />
                          <span className="truncate">Assign Worker / Specialist:</span>
                        </div>
                        {booking.assigned_worker_name && (
                          <span className="text-[10px] font-extrabold text-[#65a30d] bg-[#e2f1e7] px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                            Worker Assigned
                          </span>
                        )}
                      </div>

                      <div className="w-full min-w-0 overflow-hidden">
                        <select
                          value={booking.assigned_worker_id || ""}
                          onChange={(e) => handleAssignWorker(booking.request_id, e.target.value)}
                          disabled={assigningBookingId === booking.request_id}
                          style={{ maxWidth: '100%' }}
                          className="w-full max-w-full min-w-0 text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium focus:bg-white focus:ring-2 focus:ring-[#65a30d] outline-hidden cursor-pointer truncate"
                        >
                          <option value="">-- Select Worker --</option>
                          {workers.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name} ({w.category})
                            </option>
                          ))}
                        </select>
                      </div>

                      {booking.assigned_worker_name && (
                        <div className="flex items-center gap-2.5 bg-[#e2f1e7]/60 p-2 rounded-lg border border-emerald-200/80 mt-1 min-w-0 overflow-hidden">
                          <img
                            src={booking.assigned_worker_photo || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80"}
                            alt={booking.assigned_worker_name}
                            className="w-9 h-9 rounded-full object-cover border border-emerald-300 shrink-0"
                          />
                          <div className="text-left flex-1 min-w-0">
                            <p className="font-bold text-slate-900 text-xs flex items-center gap-1 truncate">
                              <span>Worker: {booking.assigned_worker_name}</span>
                            </p>
                            <p className="text-[10px] text-slate-600 font-mono truncate">
                              Phone: {booking.assigned_worker_phone || "Not specified"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Phone size={12} className={booking.is_personal_data_deleted ? "text-slate-300" : "text-[#65a30d]"} />
                      <span className={`font-semibold select-all ${booking.is_personal_data_deleted ? "text-slate-400 italic" : "text-slate-800"}`}>
                        {booking.is_personal_data_deleted ? "Phone deleted (6h PII auto-purge)" : (booking.mobile_number || "No contact phone logged")}
                      </span>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <FileText size={12} className="text-slate-400 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className={`font-semibold select-all ${booking.is_personal_data_deleted ? "text-slate-400 italic text-[11px]" : "text-slate-700"}`}>
                          {booking.is_personal_data_deleted ? "Location & address details deleted after 6 hrs" : (booking.address || "Address not specified")}
                        </p>
                        {booking.landmark && !booking.is_personal_data_deleted && (
                          <p className="text-[10px] text-slate-500 font-medium">
                            Landmark: <span className="text-slate-600">{booking.landmark}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* AUTOMATIC GOOGLE MAPS LINK & DISPATCH NAVIGATION */}
                    {!booking.is_personal_data_deleted && (getBookingMapsUrl(booking) !== "") && (() => {
                      const mapsUrl = getBookingMapsUrl(booking);
                      const isCopied = copiedMapsId === booking.request_id;

                      return (
                        <div className="mt-2.5 bg-[#e2f1e7]/70 border border-emerald-200/90 rounded-xl p-3 space-y-2 text-left">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                              <MapPin size={14} className="text-rose-500 shrink-0" />
                              <span>Google Maps Service Location</span>
                            </div>
                            <span className="text-[9px] font-mono font-extrabold uppercase text-[#65a30d] bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                              Auto Link
                            </span>
                          </div>

                          <div className="text-[11px] font-mono text-slate-700 bg-white/90 p-2 rounded-lg border border-slate-200/80 truncate select-all flex items-center justify-between gap-2">
                            <span className="truncate">{mapsUrl}</span>
                            {booking.latitude != null && booking.longitude != null && (
                              <span className="text-[9px] text-slate-400 shrink-0 font-sans">
                                ({booking.latitude.toFixed(4)}, {booking.longitude.toFixed(4)})
                              </span>
                            )}
                          </div>

                          {/* Action Buttons: Open, Copy, Share */}
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenMapsLink(booking);
                              }}
                              className="flex-1 min-w-[130px] py-1.5 px-3 bg-[#65a30d] hover:bg-[#52840a] text-white text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                              title="Open Google Maps link in new tab or navigation app"
                            >
                              <ExternalLink size={13} />
                              <span>Open in Google Maps</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyMapsLink(booking);
                              }}
                              className={`py-1.5 px-3 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 border transition-all active:scale-95 cursor-pointer ${
                                isCopied
                                  ? "bg-slate-900 text-white border-slate-900"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                              }`}
                              title="Copy Google Maps link to clipboard"
                            >
                              {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                              <span>{isCopied ? "Copied!" : "Copy Maps Link"}</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShareMapsLink(booking);
                              }}
                              className="py-1.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                              title="Share location link via WhatsApp, SMS, or Email"
                            >
                              <Share2 size={13} className="text-[#65a30d]" />
                              <span>Share Maps Link</span>
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {booking.additional_notes && (
                      <div className="bg-white p-2 border border-slate-200 rounded-lg text-[10px] text-slate-500 mt-1 leading-normal">
                        <span className="font-bold text-slate-600 block mb-0.5">Details:</span>
                        {booking.additional_notes}
                      </div>
                    )}

                    {!booking.is_personal_data_deleted ? (
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-medium">
                          {booking.status === "Completed" ? "Service completed — user details ready to delete" : "Customer details active"}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            pushAdminNavState(adminTab, "delete");
                            setConfirmPiiDeleteBooking(booking);
                          }}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 shadow-2xs cursor-pointer shrink-0"
                          title="Delete customer phone number and location while retaining service record"
                        >
                          <Trash2 size={11} className="text-rose-600" />
                          <span>Delete User Details</span>
                        </button>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-slate-200 flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50/80 px-2.5 py-1.5 rounded-lg border border-emerald-100">
                        <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                        <span>User Details Deleted • Service Record Permanently Retained</span>
                      </div>
                    )}
                  </div>

                  {/* Operational uuid metric identifier */}
                  <div className="mt-2 text-right">
                    <span className="text-[8px] font-mono text-slate-300 font-bold uppercase select-all">
                      ID: {booking.request_id}
                    </span>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
        )}

        {/* SECTION 1.5: PERMANENT BOOKING HISTORY TAB */}
        {adminTab === "history" && (
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="text-left">
                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <History size={18} className="text-[#65a30d]" />
                  <span>Permanent Booking History & Archives</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Permanent record of all fulfilled dispatches, completed service jobs, and specialist metrics
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => fetchBookings()}
                  disabled={loadingBookings}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RefreshCw size={12} className={loadingBookings ? "animate-spin" : ""} />
                  <span>Refresh History</span>
                </button>
              </div>
            </div>

            {/* HISTORY SUMMARY METRICS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-[#65a30d]" />
                  <span>Completed Jobs</span>
                </span>
                <p className="text-2xl font-black text-slate-900 mt-1 font-mono">
                  {historyBookings.length}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Permanently archived entries</p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Award size={13} className="text-[#65a30d]" />
                  <span>Specialists Assigned</span>
                </span>
                <p className="text-2xl font-black text-slate-900 mt-1 font-mono">
                  {new Set(historyBookings.map((b) => b.assigned_worker_id).filter(Boolean)).size}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Active technicians</p>
              </div>
            </div>

            {/* SEARCH & CATEGORY FILTER BAR */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex flex-col sm:flex-row items-center gap-2">
              <div className="relative flex-1 w-full">
                <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search history by request ID, service, worker name, or customer phone..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-medium focus:ring-1 focus:ring-[#65a30d] outline-hidden"
                />
                {historySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setHistorySearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48">
                  <select
                    value={historyCategoryFilter}
                    onChange={(e) => setHistoryCategoryFilter(e.target.value)}
                    className="w-full py-2 pl-3 pr-8 text-xs bg-white border border-slate-200 rounded-xl font-medium focus:ring-1 focus:ring-[#65a30d] outline-hidden cursor-pointer"
                  >
                    <option value="all">All Service Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {(historySearchQuery || historyCategoryFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setHistorySearchQuery("");
                      setHistoryCategoryFilter("all");
                    }}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            {/* HISTORY RECORDS LIST */}
            {loadingBookings ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                    <Skeleton className="h-4 w-1/2 rounded" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                  </div>
                ))}
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-3xl p-6 space-y-2">
                <History size={32} className="text-slate-300 mx-auto" />
                <h4 className="font-bold text-slate-700 text-sm">No Completed History Records Found</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {historySearchQuery || historyCategoryFilter !== "all"
                    ? "No completed dispatches match your search or category filter criteria."
                    : "When dispatches are completed in the Active Dispatches tab, they will appear permanently in this history archive."}
                </p>
                {(historySearchQuery || historyCategoryFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setHistorySearchQuery("");
                      setHistoryCategoryFilter("all");
                    }}
                    className="mt-2 text-xs font-bold text-[#65a30d] hover:underline cursor-pointer"
                  >
                    Clear Search Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4 text-left">
                {filteredHistory.map((h) => (
                  <div
                    key={h.request_id}
                    className="p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl space-y-3 shadow-2xs transition-all"
                  >
                    {/* Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        {h.service_type.split(",").map((st, idx) => (
                          <span
                            key={idx}
                            className="bg-emerald-100 text-[#52840a] font-extrabold text-[10px] px-2.5 py-0.5 rounded-full border border-emerald-200 uppercase"
                          >
                            {st.trim()}
                          </span>
                        ))}
                        <span className="text-[10px] text-slate-400 font-mono">
                          Completed: {new Date(h.updated_at || h.created_at).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 size={11} /> COMPLETED
                        </span>
                        <span className="text-[9px] font-mono text-slate-400 font-bold uppercase select-all">
                          ID: {h.request_id.slice(0, 12)}...
                        </span>
                      </div>
                    </div>

                    {/* Specialist & Service Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* Specialist Info */}
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <UserCheck size={12} className="text-[#65a30d]" />
                          <span>Assigned Specialist</span>
                        </div>
                        {h.assigned_worker_name ? (
                          <div className="flex items-center gap-2.5 pt-0.5">
                            <img
                              src={h.assigned_worker_photo || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80"}
                              alt={h.assigned_worker_name}
                              className="w-9 h-9 rounded-full object-cover border border-slate-300 shrink-0"
                            />
                            <div>
                              <p className="font-bold text-slate-900">{h.assigned_worker_name}</p>
                              <p className="text-[10px] text-slate-500 font-mono">
                                Phone: {h.assigned_worker_phone || "N/A"}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">No specialist assigned</p>
                        )}
                      </div>

                      {/* Customer Contact & PII Status */}
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <User size={12} className="text-slate-500" />
                          <span>Customer Record</span>
                        </div>
                        {h.is_personal_data_deleted ? (
                          <div className="text-[11px] text-slate-500 italic bg-amber-50 border border-amber-200/80 p-2 rounded-lg flex items-center gap-1.5">
                            <ShieldAlert size={14} className="text-amber-600 shrink-0" />
                            <span>Customer PII Auto-Sanitized • Record Preserved</span>
                          </div>
                        ) : (
                          <div className="space-y-1 text-slate-700">
                            <p className="font-semibold flex items-center gap-1.5">
                              <Phone size={12} className="text-[#65a30d]" />
                              <span>{h.mobile_number || "Logged"}</span>
                            </p>
                            {h.address && (
                              <p className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
                                <MapPin size={12} className="text-rose-500 shrink-0" />
                                <span className="truncate">{h.address}</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Row */}
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">Total Value:</span>
                        <span className="font-black text-slate-900 text-sm">₹{Number(h.final_amount) || h.final_amount || 399}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(h.request_id);
                            alert("Copied Request ID: " + h.request_id);
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Copy size={11} />
                          <span>Copy ID</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: WORKERS MANAGEMENT TAB */}
        {adminTab === "workers" && (
          <div className="space-y-6">
            {/* WORKERS LIST */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <h3 className="text-sm font-bold text-[#1e293b] tracking-tight flex items-center gap-2">
                    <Users size={16} className="text-[#65a30d]" />
                    <span>Worker Roster & Performance</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Track worker assignments, contact details, and completed services for incentives
                  </p>
                </div>
                <button
                  onClick={() => fetchWorkers()}
                  disabled={loadingWorkers}
                  className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-[#1e293b]"
                  title="Refresh workers"
                >
                  <RefreshCw size={12} className={loadingWorkers ? "animate-spin" : ""} />
                </button>
              </div>

              {loadingWorkers ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-1/2 rounded" />
                          <Skeleton className="h-3 w-1/3 rounded-full" />
                        </div>
                      </div>
                      <Skeleton className="h-10 w-full rounded-xl" />
                    </div>
                  ))}
                </div>
              ) : workers.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 border border-dashed rounded-2xl text-slate-400 text-xs p-4">
                  No workers registered yet. Register your first worker using the form below.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {workers.map((worker) =>
                    editingWorkerId === worker.id ? (
                      <div
                        key={worker.id}
                        className="bg-slate-50 border-2 border-[#65a30d]/40 rounded-2xl p-4 flex flex-col justify-between text-left shadow-sm relative space-y-3"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                          <span className="text-xs font-bold text-[#1e293b] flex items-center gap-1.5">
                            <Pencil size={13} className="text-[#65a30d]" />
                            Edit Worker Details
                          </span>
                          <button
                            type="button"
                            onClick={cancelEditWorker}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                            title="Cancel editing"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <div className="space-y-2 text-[11px]">
                          <div>
                            <label className="block font-bold text-slate-500 mb-0.5 uppercase tracking-wider text-[9px]">Full Name</label>
                            <input
                              type="text"
                              value={editWorkerName}
                              onChange={(e) => setEditWorkerName(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-[#65a30d] outline-hidden"
                              placeholder="Enter worker full name"
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-slate-500 mb-0.5 uppercase tracking-wider text-[9px]">Phone Number</label>
                            <input
                              type="text"
                              value={editWorkerPhone}
                              onChange={(e) => setEditWorkerPhone(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:ring-1 focus:ring-[#65a30d] outline-hidden"
                              placeholder="Enter contact number"
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-slate-500 mb-0.5 uppercase tracking-wider text-[9px]">Service Category</label>
                            <select
                              value={editWorkerCategory}
                              onChange={(e) => setEditWorkerCategory(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-[#65a30d] outline-hidden"
                            >
                              <option value="">-- Select Service Category --</option>
                              {categories.map((cat) => (
                                <option key={cat.id} value={cat.name}>
                                  {cat.name}
                                </option>
                              ))}
                              {!categories.some((c) => c.name === editWorkerCategory) && editWorkerCategory && (
                                <option value={editWorkerCategory}>{editWorkerCategory}</option>
                              )}
                            </select>
                          </div>

                          <div>
                            <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider text-[9px]">
                              Worker Photo (Upload from Gallery or Paste URL)
                            </label>

                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-11 h-11 rounded-xl border border-slate-200 bg-white shrink-0 overflow-hidden flex items-center justify-center relative shadow-2xs">
                                <img
                                  src={editWorkerPhotoPreview || editWorkerPhotoUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80"}
                                  alt="Worker preview"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              
                              <label className="flex-1 cursor-pointer bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold px-2.5 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs">
                                <ImageIcon size={13} className="text-[#65a30d]" />
                                <span className="truncate">{editWorkerPhotoFile ? editWorkerPhotoFile.name : "Choose from Gallery"}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      const file = e.target.files[0];
                                      setEditWorkerPhotoFile(file);
                                      setEditWorkerPhotoPreview(URL.createObjectURL(file));
                                    }
                                  }}
                                />
                              </label>

                              {(editWorkerPhotoFile || editWorkerPhotoPreview) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditWorkerPhotoFile(null);
                                    setEditWorkerPhotoPreview("");
                                    setEditWorkerPhotoUrl("");
                                  }}
                                  className="p-2 text-rose-500 hover:bg-rose-50 border border-rose-100 rounded-xl transition-colors"
                                  title="Clear selected photo"
                                >
                                  <X size={13} />
                                </button>
                              )}
                            </div>

                            <input
                              type="text"
                              value={editWorkerPhotoUrl}
                              onChange={(e) => {
                                setEditWorkerPhotoUrl(e.target.value);
                                if (!editWorkerPhotoFile) setEditWorkerPhotoPreview(e.target.value);
                              }}
                              className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-[10px] text-slate-700 focus:ring-1 focus:ring-[#65a30d] outline-hidden"
                              placeholder="Or paste photo URL directly..."
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                          <button
                            type="button"
                            onClick={() => handleSaveWorkerEdit(worker.id)}
                            disabled={savingWorkerEdit}
                            className="flex-1 py-1.5 bg-[#65a30d] hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1"
                          >
                            <Check size={13} />
                            <span>{savingWorkerEdit ? "Saving..." : "Save Worker"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditWorker}
                            disabled={savingWorkerEdit}
                            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={worker.id}
                        className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4 flex flex-col justify-between text-left shadow-2xs relative"
                      >
                        <div className="flex items-start gap-3">
                          <img
                            src={worker.photo_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80"}
                            alt={worker.name}
                            className="w-12 h-12 rounded-full object-cover border-2 border-slate-100 shrink-0 shadow-xs"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-slate-900 truncate">{worker.name}</h4>
                            <span className="inline-block bg-[#e2f1e7] text-[#65a30d] text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase border border-emerald-200 mt-0.5">
                              {worker.category}
                            </span>
                            <p className="text-xs text-slate-600 font-mono mt-1 flex items-center gap-1">
                              <Phone size={11} className="text-slate-400" />
                              <span>{worker.phone_number}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditWorker(worker)}
                              className="p-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-[#65a30d] rounded-lg transition-colors border border-slate-200/80"
                              title="Edit Worker Details"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteWorker(worker.id)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors border border-rose-100"
                              title="Delete Worker"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* WORKER PERFORMANCE & INCENTIVES METRICS */}
                        <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-center">
                          <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-2">
                            <span className="text-[9px] font-bold uppercase text-amber-700 block">Assigned Active</span>
                            <span className="text-sm font-black text-amber-900">{worker.assigned_jobs}</span>
                          </div>
                          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-2">
                            <span className="text-[9px] font-bold uppercase text-emerald-700 block">Services Completed</span>
                            <span className="text-sm font-black text-emerald-900">{worker.completed_jobs}</span>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* REGISTER NEW WORKER FORM */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
              <div className="text-left">
                <h3 className="text-sm font-bold text-[#1e293b] tracking-tight flex items-center gap-2">
                  <PlusCircle size={16} className="text-[#65a30d]" />
                  <span>Register New Worker</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Add worker details to assign service bookings</p>
              </div>

              {workerSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{workerSuccess}</span>
                </div>
              )}

              {workerError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>{workerError}</span>
                </div>
              )}

              <form onSubmit={handleAddWorker} className="space-y-3 text-left">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Worker Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="E.g., Ramesh Kumar"
                    value={newWorkerName}
                    onChange={(e) => setNewWorkerName(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Mobile Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="E.g., 9876543210"
                    value={newWorkerPhone}
                    onChange={(e) => setNewWorkerPhone(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Service Category / Specialization *
                  </label>
                  <select
                    value={newWorkerCategory}
                    onChange={(e) => setNewWorkerCategory(e.target.value)}
                    required
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium cursor-pointer"
                  >
                    <option value="">-- Select Service Category --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                    <option value="Plumbing">Plumbing</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Carpentry">Carpentry</option>
                    <option value="Appliance Repair">Appliance Repair</option>
                    <option value="Painting">Painting</option>
                    <option value="Cleaning">Cleaning</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Worker Photo (Upload from Gallery or Paste URL)
                  </label>

                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-12 h-12 rounded-xl border border-slate-200 bg-slate-50 shrink-0 overflow-hidden flex items-center justify-center relative shadow-2xs">
                      <img
                        src={newWorkerPhotoPreview || newWorkerPhoto || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80"}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <label className="flex-1 cursor-pointer bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#1e293b] text-xs font-bold px-3 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-2xs">
                      <ImageIcon size={15} className="text-[#65a30d]" />
                      <span className="truncate">{newWorkerPhotoFile ? newWorkerPhotoFile.name : "Choose Photo from Gallery"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            setNewWorkerPhotoFile(file);
                            setNewWorkerPhotoPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                    </label>

                    {(newWorkerPhotoFile || newWorkerPhotoPreview) && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewWorkerPhotoFile(null);
                          setNewWorkerPhotoPreview("");
                          setNewWorkerPhoto("");
                        }}
                        className="p-2.5 text-rose-500 hover:bg-rose-50 border border-rose-100 rounded-xl transition-colors shrink-0"
                        title="Clear photo"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <input
                    type="url"
                    placeholder="Or paste photo URL (https://images.unsplash...)"
                    value={newWorkerPhoto}
                    onChange={(e) => {
                      setNewWorkerPhoto(e.target.value);
                      if (!newWorkerPhotoFile) setNewWorkerPhotoPreview(e.target.value);
                    }}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={addingWorker}
                  className="w-full py-3 bg-[#65a30d] hover:bg-[#52840a] text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                >
                  <PlusCircle size={15} />
                  <span>{addingWorker ? "Registering..." : "Register Worker"}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* SECTION 3: OFFERS & COUPONS TAB */}
        {adminTab === "offers" && (
          <div className="space-y-6">
            {/* OFFERS LIST */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <h3 className="text-sm font-bold text-[#1e293b] tracking-tight flex items-center gap-2">
                    <Tag size={16} className="text-[#65a30d]" />
                    <span>Customer Discount Coupons ({offers.length})</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Coupons created here will be automatically published and displayed in the User Portal
                  </p>
                </div>
                <button
                  onClick={() => fetchOffers()}
                  disabled={loadingOffers}
                  className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-[#1e293b] cursor-pointer"
                  title="Refresh coupons"
                >
                  <RefreshCw size={12} className={loadingOffers ? "animate-spin" : ""} />
                </button>
              </div>

              {loadingOffers ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-4 bg-white border border-slate-200 rounded-2xl flex justify-between items-center gap-3">
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-1/3 rounded" />
                        <Skeleton className="h-3 w-2/3 rounded" />
                      </div>
                      <Skeleton className="h-8 w-16 rounded-xl shrink-0" />
                    </div>
                  ))}
                </div>
              ) : offers.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 border border-dashed rounded-2xl text-slate-400 text-xs p-4">
                  No coupons created yet. Add a coupon below to display it in the user portal!
                </div>
              ) : (
                <div className="space-y-3">
                  {offers.map((offer) => {
                    const discountType = offer.discount_type || "percent";
                    const discountVal = offer.discount_value || offer.discount_percentage || 0;
                    const discountBadge = discountType === "flat" ? `₹${discountVal} OFF` : `${discountVal}% OFF`;
                    const couponCode = offer.code || `OFFER${discountVal}`;

                    return (
                      <div
                        key={offer.id}
                        className={`border rounded-2xl p-4 text-left transition-all flex items-center justify-between gap-3 ${
                          offer.is_active
                            ? "bg-emerald-50/50 border-emerald-200"
                            : "bg-slate-50 border-slate-200 opacity-60"
                        }`}
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono bg-slate-900 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-md tracking-wider">
                              {couponCode}
                            </span>
                            <h4 className="text-sm font-bold text-slate-900">{offer.title}</h4>
                            <span className="bg-[#65a30d] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                              {discountBadge}
                            </span>
                            {offer.is_festival_offer && (
                              <span className="bg-amber-100 text-amber-800 text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-amber-200">
                                🎉 Festival Offer
                              </span>
                            )}
                            {offer.min_bookings_required > 0 && (
                              <span className="bg-blue-100 text-blue-800 text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-blue-200">
                                Min. {offer.min_bookings_required} Bookings
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600">{offer.description}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleToggleOffer(offer.id, offer.is_active)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                              offer.is_active
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-white text-slate-600 border-slate-300"
                            }`}
                          >
                            {offer.is_active ? "Active" : "Disabled"}
                          </button>
                          <button
                            onClick={() => handleDeleteOffer(offer.id)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-100 transition-colors cursor-pointer"
                            title="Delete Coupon"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* CREATE COUPON FORM */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
              <div className="text-left">
                <h3 className="text-sm font-bold text-[#1e293b] tracking-tight flex items-center gap-2">
                  <PlusCircle size={16} className="text-[#65a30d]" />
                  <span>Create New Discount Coupon</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Set up discount vouchers, promo codes, or loyalty rewards for user portal
                </p>
              </div>

              {offerSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{offerSuccess}</span>
                </div>
              )}

              {offerError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>{offerError}</span>
                </div>
              )}

              <form onSubmit={handleAddOffer} className="space-y-3.5 text-left">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Coupon Code *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="E.g., WELCOME100, SUMMER20"
                      value={newOfferCode}
                      onChange={(e) => setNewOfferCode(e.target.value.toUpperCase())}
                      className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Coupon Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="E.g., ₹100 Flat Discount Offer"
                      value={newOfferTitle}
                      onChange={(e) => setNewOfferTitle(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Description *
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Get ₹100 off on all home repair & maintenance services..."
                    value={newOfferDesc}
                    onChange={(e) => setNewOfferDesc(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Discount Type
                    </label>
                    <select
                      value={newOfferDiscountType}
                      onChange={(e) => setNewOfferDiscountType(e.target.value as "percent" | "flat")}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-2.5 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-semibold"
                    >
                      <option value="flat">Flat Amount (₹)</option>
                      <option value="percent">Percentage (%)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Discount Value ({newOfferDiscountType === "flat" ? "₹" : "%"})
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={newOfferDiscount}
                      onChange={(e) => setNewOfferDiscount(Number(e.target.value))}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Min Bookings Req.
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newOfferMinBookings}
                      onChange={(e) => setNewOfferMinBookings(Number(e.target.value))}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="is_festival"
                    checked={newOfferIsFestival}
                    onChange={(e) => setNewOfferIsFestival(e.target.checked)}
                    className="w-4 h-4 text-[#65a30d] rounded border-slate-300 focus:ring-[#65a30d] cursor-pointer"
                  />
                  <label htmlFor="is_festival" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Mark as Special Festival Season Offer
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={addingOffer}
                  className="w-full py-3 bg-[#65a30d] hover:bg-[#52840a] text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                >
                  <PlusCircle size={15} />
                  <span>{addingOffer ? "Creating Coupon..." : "Create & Publish Coupon"}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* SECTION 4: ADD SERVICE CATEGORY FORM */}
        {(adminTab === "all" || adminTab === "categories") && (
          <>
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
          <div className="text-left">
            <h3 className="text-sm font-bold text-[#1e293b] tracking-tight">Add Service Category</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Introduces custom dispatches on customer interface</p>
          </div>

          <form onSubmit={handleAddCategorySubmit} className="space-y-3.5 text-left">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Service Name
              </label>
              <input
                type="text"
                required
                placeholder="E.g., Appliance Servicing"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Description Text
              </label>
              <textarea
                required
                rows={2}
                placeholder="Describe this category's scope..."
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium leading-normal"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Subcategories / Sub-services with Pricing (Comma Separated)
              </label>
              <input
                type="text"
                placeholder="E.g., Tap Leakage - ₹199 - ₹299, Pipe Replacement - ₹349 - ₹549"
                value={newCatSubcats}
                onChange={(e) => setNewCatSubcats(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium"
              />
              <p className="text-[10px] text-slate-400 mt-1">Add subcategories with estimated price ranges or fixed prices (e.g., Task Name - ₹199 - ₹299 or Task Name - ₹249).</p>
            </div>

            {/* Simulated expo-image-picker file uploader */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Category Cover Image
              </label>
              <div className="mt-1 flex items-center gap-4">
                <label className="cursor-pointer bg-[#e2f1e7] hover:bg-emerald-100 text-[#65a30d] px-3 py-2 rounded-xl text-xs font-bold transition-all border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                  <PlusCircle size={14} />
                  <span>Choose Photo</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {newCatImage ? newCatImage.name : "No image selected"}
                </span>
              </div>

              {/* Cover Preview */}
              {imagePreview && (
                <div className="mt-3 relative w-20 h-20 rounded-xl overflow-hidden border border-slate-300">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* STRICT 30MB INTERCEPT SYSTEM ALERT */}
            {coralAlert && (
              <div className="p-3 bg-[#fff1f2] border border-rose-100 text-rose-700 rounded-xl text-[10px] font-semibold leading-relaxed flex items-start gap-2 animate-pulse">
                <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-500" />
                <div>{coralAlert}</div>
              </div>
            )}

            {categorySuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-[10px] font-semibold leading-normal flex items-start gap-2">
                <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-500" />
                <div>{categorySuccess}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={addingCat}
              className="w-full py-3 bg-[#1e293b] text-white font-bold rounded-xl text-xs tracking-wider uppercase shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {addingCat ? "Uploading service cover..." : "Publish Service Category"}
            </button>
          </form>
        </div>

        {/* SECTION 3: MANAGE / DELETE CATEGORIES */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
          <div className="text-left">
            <h3 className="text-sm font-bold text-[#1e293b]">Active Directories</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Delete categories to pull them out of customer client instantly</p>
          </div>

          {deleteError && (
            <div className="p-3 bg-[#fff1f2] border border-rose-100 text-rose-700 rounded-xl text-[10px] font-semibold leading-relaxed flex items-start gap-2 animate-pulse">
              <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-500" />
              <div>{deleteError}</div>
            </div>
          )}

          {deleteSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-[10px] font-semibold leading-normal flex items-start gap-2">
              <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-500" />
              <div>{deleteSuccess}</div>
            </div>
          )}

          {loadingCats ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-1/3 rounded" />
                    <Skeleton className="h-2.5 w-2/3 rounded" />
                  </div>
                  <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                </div>
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center text-slate-400 text-xs">No active service categories.</div>
          ) : (
            <div className="space-y-3">
              {categories.map((cat) => (
                <div 
                  key={cat.id}
                  className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-left space-y-3 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <img 
                      src={cat.image_url} 
                      alt={cat.name} 
                      className="w-11 h-11 rounded-xl object-cover border shrink-0 bg-slate-100" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-[#1e293b] truncate">{cat.name}</h4>
                      <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">{cat.description}</p>
                    </div>
                    {deletingCatId === cat.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="px-2.5 py-1 bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold rounded-lg transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingCatId(null)}
                          className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openPriceManager(cat)}
                          className="px-2.5 py-1.5 bg-[#e2f1e7] hover:bg-[#d2e8db] text-[#65a30d] border border-[#65a30d]/30 font-extrabold text-[10px] rounded-lg transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                          title="Open price management & rate card for this category"
                        >
                          <DollarSign size={12} className="stroke-[2.5]" />
                          <span>Manage Prices</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingCatId(cat.id)}
                          className="p-2 bg-white text-rose-500 hover:bg-[#fff1f2] border border-slate-200 rounded-lg transition-colors shadow-2xs shrink-0 cursor-pointer"
                          title="Delete service directory"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* SUBCATEGORIES MANAGEMENT BOX */}
                  <div className="pt-2 border-t border-slate-200/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                        <Tag size={12} className="text-[#65a30d]" />
                        <span>Subcategories & Sub-services:</span>
                      </div>
                      <span className="text-[9px] font-semibold text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded-md">
                        {(cat.subcategories || []).length} available
                      </span>
                    </div>

                    {/* SUBCATEGORY PILLS */}
                    <div className="flex flex-wrap gap-1.5">
                      {(cat.subcategories || []).length === 0 ? (
                        <span className="text-[10px] text-slate-400 italic">No subcategories defined yet.</span>
                      ) : (
                        (cat.subcategories || []).map((sub, idx) => {
                          const formatted = formatSubcategoryDisplay(sub);
                          return (
                            <span 
                              key={idx}
                              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 text-[10px] font-medium px-2 py-0.5 rounded-lg shadow-2xs"
                            >
                              <span>{formatted.name}</span>
                              {formatted.displayPrice && (
                                <span className="text-[9px] font-bold text-[#65a30d] bg-[#e2f1e7] px-1 rounded">
                                  {formatted.displayPrice}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveSubcategoryFromCat(cat.id, sub)}
                                disabled={updatingSubcats}
                                className="text-slate-400 hover:text-rose-500 transition-colors p-0.5 cursor-pointer"
                                title={`Remove "${formatted.name}"`}
                              >
                                <X size={10} />
                              </button>
                            </span>
                          );
                        })
                      )}
                    </div>

                    {/* ADD SUBCATEGORY INLINE FORM */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="E.g., Fan Repair - ₹249 - ₹399"
                        value={subcatInputMap[cat.id] || ""}
                        onChange={(e) => setSubcatInputMap((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddSubcategoryToCat(cat.id);
                          }
                        }}
                        className="flex-1 text-[11px] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddSubcategoryToCat(cat.id)}
                        disabled={updatingSubcats || !(subcatInputMap[cat.id] || "").trim()}
                        className="px-2.5 py-1.5 bg-[#65a30d] hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-[10px] rounded-lg transition-all shrink-0 flex items-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <PlusCircle size={11} />
                        <span>Add Sub</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
          </>
        )}
      </div>

      {/* GOOGLE MAPS LINK SHARE MODAL */}
      {shareBooking && (() => {
        const mapsUrl = getBookingMapsUrl(shareBooking);
        const encodedText = encodeURIComponent(`Customer Service Location for Booking #${shareBooking.request_id.slice(0, 8)} (${shareBooking.service_type}):\n${mapsUrl}`);
        const whatsappUrl = `https://wa.me/?text=${encodedText}`;
        const smsUrl = `sms:?body=${encodedText}`;
        const mailtoUrl = `mailto:?subject=${encodeURIComponent("Customer Service Location - FixHome")}&body=${encodedText}`;

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4 text-left animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#e2f1e7] text-[#65a30d] flex items-center justify-center">
                    <Share2 size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#1e293b]">Share Google Maps Link</h3>
                    <p className="text-[10px] text-slate-400 font-mono">ID: {shareBooking.request_id.slice(0, 8)}...</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShareBooking(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Generated Google Maps URL</label>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 break-all select-all">
                  {mapsUrl}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Select Sharing Channel</span>

                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 rounded-2xl flex items-center justify-center gap-2 transition-all"
                  >
                    <Send size={14} className="text-emerald-600" />
                    <span>WhatsApp</span>
                  </a>

                  <a
                    href={smsUrl}
                    className="p-3 bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200 rounded-2xl flex items-center justify-center gap-2 transition-all"
                  >
                    <Phone size={14} className="text-blue-600" />
                    <span>SMS</span>
                  </a>

                  <a
                    href={mailtoUrl}
                    className="p-3 bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200 rounded-2xl flex items-center justify-center gap-2 transition-all"
                  >
                    <FileText size={14} className="text-purple-600" />
                    <span>Email</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(mapsUrl);
                      setShareCopyFeedback(true);
                      setTimeout(() => setShareCopyFeedback(false), 2000);
                    }}
                    className="p-3 bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {shareCopyFeedback ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    <span>{shareCopyFeedback ? "Copied!" : "Copy Link"}</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShareBooking(null)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all mt-2 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        );
      })()}

      {/* CONFIRMATION MODAL FOR DELETING CUSTOMER USER DETAILS */}
      {confirmPiiDeleteBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1e293b]">Delete Customer User Details?</h3>
                <p className="text-[10px] text-slate-400 font-mono">Request ID: {confirmPiiDeleteBooking.request_id}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-2 leading-relaxed text-left">
              <p className="font-semibold text-slate-800">This action will permanently delete:</p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-700 font-medium">
                <li>Customer Mobile Number ({confirmPiiDeleteBooking.mobile_number || "N/A"})</li>
                <li>Dispatch Address ({confirmPiiDeleteBooking.address || "N/A"})</li>
                <li>GPS Location Coordinates & Landmark</li>
                <li>Additional Defect Notes</li>
              </ul>
              <div className="text-[10px] text-emerald-700 font-bold pt-2 border-t border-slate-200/80 flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                <span>The service record ({confirmPiiDeleteBooking.service_type}, Status: {confirmPiiDeleteBooking.status}) will be retained.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={deletingPii}
                onClick={() => setConfirmPiiDeleteBooking(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingPii}
                onClick={() => executeDeleteUserDetails(confirmPiiDeleteBooking.request_id)}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                {deletingPii ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Deleting Details...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={12} />
                    <span>Yes, Delete User Details</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRICE MANAGEMENT MODAL */}
      {editingPriceCat && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 shadow-2xl border border-slate-100 space-y-4 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-[#65a30d]">
                <div className="w-10 h-10 rounded-2xl bg-[#e2f1e7] flex items-center justify-center shrink-0">
                  <DollarSign size={20} className="stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1e293b]">
                    Price & Rate Management
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Category: <span className="font-bold text-slate-800">{editingPriceCat.name}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingPriceCat(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Define custom estimated price ranges or fixed prices for each sub-task in this service category. Customers will see these rates when selecting services.
            </p>

            <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1">
              {priceManageTasks.map((task) => (
                <div 
                  key={task.id}
                  className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      Task Name / Sub-service
                    </label>
                    <input
                      type="text"
                      value={task.name}
                      onChange={(e) => {
                        const newName = e.target.value;
                        setPriceManageTasks((prev) =>
                          prev.map((t) => (t.id === task.id ? { ...t, name: newName } : t))
                        );
                      }}
                      placeholder="E.g., Tap Leakage Repair"
                      className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium focus:ring-1 focus:ring-[#65a30d] outline-hidden"
                    />
                  </div>

                  <div className="w-28 shrink-0">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      Min Rate (₹)
                    </label>
                    <input
                      type="number"
                      value={task.minPrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPriceManageTasks((prev) =>
                          prev.map((t) => (t.id === task.id ? { ...t, minPrice: val } : t))
                        );
                      }}
                      placeholder="199"
                      className="w-full text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2 font-bold text-slate-800 focus:ring-1 focus:ring-[#65a30d] outline-hidden"
                    />
                  </div>

                  <div className="w-28 shrink-0">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      Max Rate (₹)
                    </label>
                    <input
                      type="number"
                      value={task.maxPrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPriceManageTasks((prev) =>
                          prev.map((t) => (t.id === task.id ? { ...t, maxPrice: val } : t))
                        );
                      }}
                      placeholder="299"
                      className="w-full text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2 font-bold text-slate-800 focus:ring-1 focus:ring-[#65a30d] outline-hidden"
                    />
                  </div>

                  <div className="flex items-end sm:pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setPriceManageTasks((prev) => prev.filter((t) => t.id !== task.id));
                      }}
                      className="p-2 text-rose-500 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
                      title="Remove task"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setPriceManageTasks((prev) => [
                  ...prev,
                  { id: `pm_${Date.now()}`, name: "", minPrice: "199", maxPrice: "299" }
                ]);
              }}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Another Task & Price Rate</span>
            </button>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={savingPrices}
                onClick={() => setEditingPriceCat(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingPrices}
                onClick={handleSavePriceManagement}
                className="px-5 py-2.5 bg-[#65a30d] hover:bg-[#52840a] disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                {savingPrices ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Saving Prices...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Save All Prices & Rates</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
