import React, { useState, useEffect, useRef } from "react";
import { Bell, CheckCircle2, Copy, X, Smartphone, AlertCircle, Info, Send, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { requestFCMToken, onForegroundMessage, registerDeviceToken, db } from "../lib/firebase";
import { FCMNotification } from "../types";
import { collection, onSnapshot, query } from "firebase/firestore";

interface NotificationCenterProps {
  userRole?: "customer" | "admin";
  userPhone?: string;
  className?: string;
}

export default function NotificationCenter({ userRole = "customer", userPhone, className = "" }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(localStorage.getItem("fixhome_fcm_token"));
  const [fcmMode, setFcmMode] = useState<string | null>(localStorage.getItem("fixhome_fcm_mode") || (localStorage.getItem("fixhome_fcm_token") ? "in_app" : null));
  const [permissionStatus, setPermissionStatus] = useState<"granted" | "denied" | "default" | "in_app">(
    localStorage.getItem("fixhome_fcm_token") ? "granted" : "default"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Stored Notifications
  const [notifications, setNotifications] = useState<FCMNotification[]>(() => {
    try {
      const saved = localStorage.getItem("fixhome_notifications");
      return saved ? JSON.parse(saved) : [
        {
          id: "welcome-1",
          title: "Welcome to FixHome!",
          body: "Push notifications are active. You will receive real-time updates on your service bookings.",
          timestamp: new Date().toISOString(),
          read: false,
          type: "system"
        }
      ];
    } catch (e) {
      return [];
    }
  });

  // Active Toast Alert
  const [activeToast, setActiveToast] = useState<{ title: string; body: string } | null>(null);

  // Save notifications to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("fixhome_notifications", JSON.stringify(notifications));
    } catch (e) {}
  }, [notifications]);

  // Sync token and current portal role (admin vs customer) with backend server
  useEffect(() => {
    if (fcmToken) {
      registerDeviceToken(fcmToken, userPhone, userRole);
    }
  }, [fcmToken, userRole, userPhone]);

  // Check and auto-initialize FCM push status on mount
  useEffect(() => {
    const initFCM = async () => {
      const savedToken = localStorage.getItem("fixhome_fcm_token");
      const savedMode = localStorage.getItem("fixhome_fcm_mode");

      if (savedToken) {
        setFcmToken(savedToken);
        setFcmMode(savedMode || "in_app");
        setPermissionStatus("granted");
        registerDeviceToken(savedToken, userPhone, userRole);
      } else {
        // Automatically attempt background registration so notifications work out of the box
        const result = await requestFCMToken();
        if (result.token) {
          setFcmToken(result.token);
          setFcmMode(result.mode);
          setPermissionStatus("granted");
          registerDeviceToken(result.token, userPhone, userRole);
        }
      }
    };

    initFCM();
  }, [userRole, userPhone]);

  // Listen for real-time foreground messages
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    onForegroundMessage((payload) => {
      const newNotif: FCMNotification = {
        id: "fcm-" + Date.now(),
        title: payload.title || "FixHome Notification",
        body: payload.body || "You have a new update.",
        timestamp: new Date().toISOString(),
        read: false,
        type: "booking",
        data: payload.data
      };

      setNotifications((prev) => [newNotif, ...prev]);
      setActiveToast({ title: newNotif.title, body: newNotif.body });

      // Auto dismiss toast after 6s
      setTimeout(() => {
        setActiveToast(null);
      }, 6000);
    }).then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Real-time Firestore listening service for Admin: watch for new booking documents and trigger local notifications
  const initialBookingIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef<boolean>(true);

  useEffect(() => {
    if (userRole !== "admin") return;

    isInitialLoadRef.current = true;

    const q = query(collection(db, "bookings"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            const bookingId = change.doc.id || data.request_id;

            if (isInitialLoadRef.current) {
              if (bookingId) initialBookingIdsRef.current.add(bookingId);
            } else if (bookingId && !initialBookingIdsRef.current.has(bookingId)) {
              initialBookingIdsRef.current.add(bookingId);

              // 1. Play audio chime on admin device
              try {
                const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioCtx) {
                  const ctx = new AudioCtx();
                  const now = ctx.currentTime;
                  const osc = ctx.createOscillator();
                  const gain = ctx.createGain();
                  osc.type = "sine";
                  osc.frequency.setValueAtTime(880, now);
                  gain.gain.setValueAtTime(0.3, now);
                  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                  osc.connect(gain);
                  gain.connect(ctx.destination);
                  osc.start(now);
                  osc.stop(now + 0.4);
                }
              } catch (e) {}

              // 2. Create local notification entry in Admin UI
              const notifTitle = "🚨 NEW SERVICE BOOKING RECEIVED!";
              const notifBody = `Service: ${data.service_type || 'Booking'} | Mobile: ${data.mobile_number || 'Customer'}`;

              const newNotif: FCMNotification = {
                id: "realtime-booking-" + bookingId + "-" + Date.now(),
                title: notifTitle,
                body: notifBody,
                timestamp: new Date().toISOString(),
                read: false,
                type: "admin",
                data: { bookingId }
              };

              setNotifications((prev) => [newNotif, ...prev]);
              setActiveToast({ title: notifTitle, body: notifBody });

              // Auto dismiss toast
              setTimeout(() => {
                setActiveToast(null);
              }, 7000);

              // 3. Trigger native mobile/browser push notification bar on admin device
              if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
                try {
                  if ("serviceWorker" in navigator) {
                    navigator.serviceWorker.getRegistration().then((reg) => {
                      if (reg) {
                        reg.showNotification(notifTitle, {
                          body: notifBody,
                          icon: "/fixhome_logo.jpg",
                          badge: "/fixhome_logo.jpg",
                          vibrate: [200, 100, 200],
                          requireInteraction: true,
                          data: { bookingId }
                        } as any);
                      }
                    });
                  } else {
                    new Notification(notifTitle, {
                      body: notifBody,
                      icon: "/fixhome_logo.jpg",
                      vibrate: [200, 100, 200]
                    } as any);
                  }
                } catch (err) {
                  console.warn("Direct notification launch error:", err);
                }
              }

              // 4. Dispatch live event so AdminPortal updates immediately
              window.dispatchEvent(new CustomEvent("fix_home_new_booking", { detail: data }));
            }
          }
        });

        isInitialLoadRef.current = false;
      },
      (error) => {
        console.warn("Firestore real-time booking listener error:", error);
      }
    );

    return () => unsubscribe();
  }, [userRole]);

  // Handler to request FCM Push Token
  const handleEnablePush = async () => {
    setIsLoading(true);
    setStatusMessage(null);

    const result = await requestFCMToken();
    setIsLoading(false);

    if (result.token) {
      setFcmToken(result.token);
      setFcmMode(result.mode);
      setPermissionStatus("granted");
      
      if (result.mode === "web_push") {
        setStatusMessage({ type: "success", text: "FCM Browser Web Push Notifications enabled!" });
      } else {
        setStatusMessage({
          type: "success",
          text: "In-App FCM Push Notifications activated! Real-time alerts and toast notifications are ready."
        });
      }
      await registerDeviceToken(result.token, userPhone, userRole);
    } else {
      setStatusMessage({
        type: "error",
        text: result.error || "Could not enable notifications. Please check your browser permission settings."
      });
    }
  };

  const handleCopyToken = () => {
    if (!fcmToken) return;
    navigator.clipboard.writeText(fcmToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendTestNotification = async () => {
    setIsLoading(true);
    try {
      const isTargetAdmin = userRole === "admin";
      const testTitle = isTargetAdmin ? "🚨 Admin Alert: FCM Test Notification" : "🔔 FixHome FCM Test Notification";
      const testBody = isTargetAdmin
        ? "FixHome Admin Device Alert: You will receive instant notifications here when a customer books a service or submits a request!"
        : "Your FCM push notification setup is working perfectly on FixHome!";

      // Local notification
      const testNotif: FCMNotification = {
        id: "test-" + Date.now(),
        title: testTitle,
        body: testBody,
        timestamp: new Date().toISOString(),
        read: false,
        type: isTargetAdmin ? "admin" : "system"
      };

      setNotifications((prev) => [testNotif, ...prev]);
      setActiveToast({ title: testNotif.title, body: testNotif.body });
      setStatusMessage({
        type: "success",
        text: isTargetAdmin
          ? "Admin test push notification sent to all registered Admin devices!"
          : "Customer test notification triggered!"
      });

      // Send to server targeting role
      await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: fcmToken,
          targetRole: userRole,
          title: testTitle,
          body: testBody,
          data: { type: isTargetAdmin ? "admin_alert" : "customer_alert" }
        })
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all focus:outline-none focus:ring-2 focus:ring-[#65A30D]/50 active:scale-95"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={20} className="text-slate-700" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white shadow-sm animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Foreground Toast Notification Popup */}
      {activeToast && (
        <div className="fixed top-20 right-4 z-[9999] max-w-sm w-full bg-slate-900/95 text-white p-4 rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-md animate-bounce-short flex items-start gap-3">
          <div className="p-2 bg-[#65A30D]/20 rounded-xl text-[#65A30D] shrink-0 mt-0.5">
            <Sparkles size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm text-white truncate">{activeToast.title}</h4>
            <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">{activeToast.body}</p>
          </div>
          <button
            onClick={() => setActiveToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Notification Drawer Modal */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#65A30D]/20 text-[#65A30D]">
                  <Bell size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight">Notification Center</h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    Firebase Cloud Messaging (FCM)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* FCM Setup & Permission Status Banner */}
            <div className="p-3.5 bg-slate-50 border-b border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Smartphone size={14} className="text-[#65A30D]" /> FCM Push Status:
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    permissionStatus === "granted"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : permissionStatus === "denied"
                      ? "bg-rose-100 text-rose-800 border border-rose-300"
                      : "bg-amber-100 text-amber-800 border border-amber-300"
                  }`}
                >
                  {permissionStatus === "granted"
                    ? fcmMode === "web_push"
                      ? "Active (Web Push)"
                      : "Active (In-App Push)"
                    : permissionStatus === "denied"
                    ? "Blocked"
                    : "Disabled"}
                </span>
              </div>

              {permissionStatus !== "granted" && (
                <button
                  onClick={handleEnablePush}
                  disabled={isLoading}
                  className="w-full py-2.5 px-3 bg-[#65A30D] hover:bg-[#54870B] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck size={16} /> Enable FCM Push Notifications
                    </>
                  )}
                </button>
              )}

              {permissionStatus === "granted" && fcmToken && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono bg-white p-2 rounded-lg border border-slate-200">
                    <span className="truncate max-w-[210px] font-semibold text-slate-700">
                      Token: {fcmToken.substring(0, 18)}...
                    </span>
                    <button
                      onClick={handleCopyToken}
                      className="text-[#65A30D] hover:underline font-bold flex items-center gap-1 shrink-0 ml-1"
                    >
                      <Copy size={12} /> {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              )}

              {statusMessage && (
                <div
                  className={`p-2.5 rounded-xl text-xs flex items-start gap-2 ${
                    statusMessage.type === "success"
                      ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                      : "bg-rose-50 text-rose-900 border border-rose-200"
                  }`}
                >
                  {statusMessage.type === "success" ? (
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertCircle size={16} className="shrink-0 text-rose-600 mt-0.5" />
                  )}
                  <span className="leading-tight font-medium">{statusMessage.text}</span>
                </div>
              )}

              {permissionStatus === "granted" && (
                <button
                  onClick={handleSendTestNotification}
                  disabled={isLoading}
                  className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Send size={14} className="text-[#65A30D]" /> Trigger Test Push Alert
                </button>
              )}
            </div>

            {/* Notification Actions */}
            {notifications.length > 0 && (
              <div className="px-4 py-2 bg-slate-100 flex items-center justify-between text-xs text-slate-600 border-b border-slate-200/60">
                <span>
                  {unreadCount > 0 ? `${unreadCount} unread` : "All notifications read"}
                </span>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[#65A30D] hover:underline font-semibold text-[11px]"
                    >
                      Mark read
                    </button>
                  )}
                  <button
                    onClick={clearAllNotifications}
                    className="text-slate-400 hover:text-rose-600 transition-colors"
                    title="Clear All"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Notification Items List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-slate-400 space-y-2">
                  <Info size={28} className="mx-auto text-slate-300" />
                  <p className="text-xs font-semibold">No notifications yet</p>
                  <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto">
                    Important alerts and booking updates will appear here.
                  </p>
                </div>
              ) : (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl transition-colors ${
                      item.read ? "bg-white text-slate-600" : "bg-slate-50 text-slate-900 font-medium"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {!item.read && (
                          <span className="w-2 h-2 rounded-full bg-[#65A30D] shrink-0" />
                        )}
                        <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed pl-3.5">
                      {item.body}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
