import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getMessaging, getToken, onMessage, isSupported, Messaging } from "firebase/messaging";
import firebaseConfigData from "../../firebase-applet-config.json";

export const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey || "AIzaSyDF-7MYIN2Q7edWkCVpWzlWN3Khah6UCVg",
  authDomain: firebaseConfigData.authDomain || "quick-services-fsebmv.firebaseapp.com",
  projectId: firebaseConfigData.projectId || "quick-services-fsebmv",
  storageBucket: firebaseConfigData.storageBucket || "quick-services-fsebmv.firebasestorage.app",
  messagingSenderId: firebaseConfigData.messagingSenderId || "759211290458",
  appId: firebaseConfigData.appId || "1:759211290458:web:3cba99a6d1c5a2aea44d63"
};

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfigData.firestoreDatabaseId);
export const auth = getAuth(app);

let messagingInstance: Messaging | null = null;

// Helper to safely get messaging instance
export async function getFCMInstance(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  try {
    const supported = await isSupported();
    if (supported && typeof window !== "undefined" && "serviceWorker" in navigator) {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }
  } catch (err) {
    console.warn("FCM Messaging is not supported in this browser context:", err);
  }
  return null;
}

// Request Notification Permission and Fetch FCM Token with fallback for WebViews
export async function requestFCMToken(): Promise<{ token: string | null; isWebPushSupported: boolean; mode: "web_push" | "in_app"; error: string | null }> {
  try {
    const hasNotificationAPI = typeof window !== "undefined" && "Notification" in window && typeof Notification.requestPermission === "function";

    if (hasNotificationAPI) {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const messaging = await getFCMInstance();
        if (messaging) {
          let swRegistration: ServiceWorkerRegistration | undefined;
          if ("serviceWorker" in navigator) {
            swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
              scope: "/"
            }).catch(() => undefined);
          }

          try {
            const token = await getToken(messaging, { serviceWorkerRegistration: swRegistration });
            if (token) {
              console.log("FCM Device Token retrieved:", token);
              localStorage.setItem("fixhome_fcm_token", token);
              localStorage.setItem("fixhome_fcm_mode", "web_push");
              return { token, isWebPushSupported: true, mode: "web_push", error: null };
            }
          } catch (fcmErr) {
            console.warn("FCM getToken failed, falling back to In-App FCM mode:", fcmErr);
          }
        }
      } else if (permission === "denied") {
        return { token: null, isWebPushSupported: true, mode: "in_app", error: "Notification permission was denied in browser settings." };
      }
    }

    // Fallback for WebViews, iFrames, or contexts where Notification API is restricted
    let existingInAppToken = localStorage.getItem("fixhome_fcm_token");
    if (!existingInAppToken) {
      existingInAppToken = "fixhome_fcm_inapp_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem("fixhome_fcm_token", existingInAppToken);
    }
    localStorage.setItem("fixhome_fcm_mode", "in_app");

    return {
      token: existingInAppToken,
      isWebPushSupported: false,
      mode: "in_app",
      error: null
    };
  } catch (err: any) {
    console.error("Error retrieving FCM Token:", err);
    
    // Safety fallback so user is never blocked
    let fallbackToken = localStorage.getItem("fixhome_fcm_token") || ("fixhome_fcm_inapp_" + Date.now());
    localStorage.setItem("fixhome_fcm_token", fallbackToken);
    localStorage.setItem("fixhome_fcm_mode", "in_app");

    return { token: fallbackToken, isWebPushSupported: false, mode: "in_app", error: null };
  }
}

// Subscribe to Foreground Messages
export async function onForegroundMessage(
  callback: (payload: { title?: string; body?: string; data?: Record<string, string> }) => void
): Promise<() => void> {
  const messaging = await getFCMInstance();
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    console.log("Foreground FCM message received:", payload);
    const notification = {
      title: payload.notification?.title || payload.data?.title || "FixHome Notification",
      body: payload.notification?.body || payload.data?.body || "New update received",
      data: payload.data
    };
    callback(notification);
  });
}

// Send Device Token to Server / Local storage registration
export async function registerDeviceToken(token: string, userId?: string, role: string = "customer") {
  try {
    await fetch("/api/notifications/register-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, userId, role })
    });
  } catch (e) {
    console.warn("Could not send token to backend:", e);
  }
}
