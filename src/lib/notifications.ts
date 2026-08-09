// Notification Dispatcher Helper for FixHome
export async function sendFCMPushNotification({
  targetRole,
  token,
  title,
  body,
  data
}: {
  targetRole?: "admin" | "customer";
  token?: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  try {
    // 1. Dispatch through server endpoint
    await fetch("/api/notifications/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        targetRole,
        title,
        body,
        data: data || {}
      })
    });

    // 2. Also save to local notification store for active UI
    const savedNotifs = localStorage.getItem("fixhome_notifications");
    const currentNotifs = savedNotifs ? JSON.parse(savedNotifs) : [];
    const newNotif = {
      id: "fcm-notif-" + Date.now(),
      title,
      body,
      timestamp: new Date().toISOString(),
      read: false,
      type: targetRole === "admin" ? "admin" : "booking",
      data
    };
    localStorage.setItem("fixhome_notifications", JSON.stringify([newNotif, ...currentNotifs]));

    // 3. Trigger Browser Notification API directly if available & permitted (works when background / tab active)
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            reg.showNotification(title, {
              body,
              icon: "/fixhome_logo.jpg",
              badge: "/fixhome_logo.jpg",
              vibrate: [200, 100, 200],
              requireInteraction: true,
              data: data || {}
            } as any);
            return;
          }
        }
        new Notification(title, {
          body,
          icon: "/fixhome_logo.jpg",
          vibrate: [200, 100, 200]
        } as any);
      } catch (err) {
        console.warn("Direct Notification instantiation error:", err);
      }
    }
  } catch (err) {
    console.error("Failed to send FCM push notification:", err);
  }
}
