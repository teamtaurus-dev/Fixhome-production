// Utility logger for tracking Navigation, History Stack, and Hardware Back Button events
// to diagnose intermittent application exit behavior on Android devices.

export interface NavLogEntry {
  timestamp: string;
  source: string;
  action: string;
  historyLength: number;
  historyState: any;
  details?: any;
}

const STORAGE_KEY = "fixhome_nav_logs";
const MAX_LOGS = 100;

export function logNav(source: string, action: string, details?: any) {
  const entry: NavLogEntry = {
    timestamp: new Date().toISOString(),
    source,
    action,
    historyLength: typeof window !== "undefined" ? window.history.length : 0,
    historyState: typeof window !== "undefined" ? window.history.state : null,
    details: details || null,
  };

  // 1. Log to Browser Console
  console.log(`%c[NavLog][${source}] ${action}`, "color: #0284c7; font-weight: bold;", {
    historyLength: entry.historyLength,
    historyState: entry.historyState,
    details: entry.details,
    timestamp: entry.timestamp,
  });

  // 2. Persist to sessionStorage for post-exit analysis
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      const existingRaw = window.sessionStorage.getItem(STORAGE_KEY);
      const existing: NavLogEntry[] = existingRaw ? JSON.parse(existingRaw) : [];
      existing.push(entry);
      if (existing.length > MAX_LOGS) {
        existing.shift();
      }
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch (err) {
      console.warn("Failed to save nav log to sessionStorage:", err);
    }
  }

  // 3. Notify React Native WebView container of navigation state
  notifyNavState();
}

export function notifyNavState() {
  if (typeof window === "undefined") return;
  try {
    const st = window.history.state;
    // User is at root baseline if in customer portal, 'book' section, with no active modal
    const isRoot = !st || Boolean(st.isRootGuard) || (st.fixHomeTab === "customer" && st.section === "book" && !st.modal);
    // JS webview can always handle back state because root guard entry trap exists in history
    const canGoBack = true;
    if ((window as any).ReactNativeWebView?.postMessage) {
      (window as any).ReactNativeWebView.postMessage(
        JSON.stringify({
          type: "NAV_STATE",
          canGoBack,
          isRoot,
          state: st,
          historyLength: window.history.length,
        })
      );
    }
  } catch (e) {
    console.warn("Failed to post message to ReactNativeWebView:", e);
  }
}

// Global lifecycle monitors to catch App exit / unload events
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", (e) => {
    logNav("ExitMonitor", `pagehide event fired (persisted: ${e.persisted})`, {
      visibilityState: document.visibilityState,
    });
  });

  window.addEventListener("beforeunload", () => {
    logNav("ExitMonitor", "beforeunload event fired", {
      visibilityState: document.visibilityState,
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      logNav("ExitMonitor", "visibilitychange -> hidden (App moved to background or closed)", {
        historyLength: window.history.length,
        historyState: window.history.state,
      });
    }
  });
}
