import { logNav } from "./navLogger";

export function notifyNativeBackState(overrideCanGoBack?: boolean) {
  try {
    const st = typeof window !== "undefined" ? window.history.state || {} : {};
    const isRootState = !st || Boolean(st.isRootGuard) || (st.fixHomeTab === "customer" && st.section === "book" && !st.modal);
    const canGoBack = overrideCanGoBack !== undefined ? overrideCanGoBack : !isRootState;
    const isRoot = !canGoBack;

    if (typeof window !== "undefined") {
      const w = window as any;
      const msg = JSON.stringify({ canGoBack, isRoot, action: "backStateUpdate", type: "NAV_STATE" });
      if (w.ReactNativeWebView?.postMessage) {
        w.ReactNativeWebView.postMessage(msg);
      }
      if (w.AndroidInterface?.setCanGoBack) {
        w.AndroidInterface.setCanGoBack(canGoBack);
      }
      if (w.AndroidBridge?.setCanGoBack) {
        w.AndroidBridge.setCanGoBack(canGoBack);
      }
      if (w.Android?.setCanGoBack) {
        w.Android.setCanGoBack(canGoBack);
      }
      if (w.FixHomeApp?.setCanGoBack) {
        w.FixHomeApp.setCanGoBack(canGoBack);
      }
      if (w.FixHomeAndroid?.setCanGoBack) {
        w.FixHomeAndroid.setCanGoBack(canGoBack);
      }
    }
  } catch (e) {}
}

export function dialNativePhoneNumber(rawPhoneNumber: string) {
  if (typeof window === "undefined") return;

  const raw = (rawPhoneNumber || "+919966747473").trim();
  const digits = raw.replace(/[^\d+]/g, "");
  const localDigits = digits.startsWith("+91") ? digits.slice(3) : digits;
  const formattedTel = digits.startsWith("+") 
    ? digits 
    : (digits.length === 10 ? `+91${digits}` : digits);
  
  const telUri = `tel:${formattedTel}`;
  const localTelUri = `tel:${localDigits}`;
  const androidIntentUri = `intent://${localDigits}#Intent;scheme=tel;action=android.intent.action.DIAL;end`;
  const androidIntentWithData = `intent:#Intent;action=android.intent.action.DIAL;data=tel:${encodeURIComponent(formattedTel)};end`;
  const w = window as any;

  logNav("NativeBridge", "dialNativePhoneNumber() invoked", {
    rawPhoneNumber,
    formattedTel,
    localDigits,
    telUri,
    androidIntentUri
  });

  // 0. Instant Clipboard Copy (so user has number ready even if app blocks dialer)
  try {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(formattedTel);
    }
  } catch (e) {}

  // 1. React Native WebView message passing
  if (w.ReactNativeWebView?.postMessage) {
    try {
      w.ReactNativeWebView.postMessage(JSON.stringify({ 
        action: "call", 
        type: "CALL_PHONE", 
        number: formattedTel, 
        rawNumber: raw,
        url: telUri 
      }));
    } catch (e) {}
    try {
      w.ReactNativeWebView.postMessage(JSON.stringify({ 
        action: "openUrl", 
        type: "OPEN_URL", 
        url: telUri 
      }));
    } catch (e) {}
    try {
      w.ReactNativeWebView.postMessage(JSON.stringify({ 
        action: "dial", 
        number: formattedTel 
      }));
    } catch (e) {}
    try {
      w.ReactNativeWebView.postMessage(telUri);
    } catch (e) {}
  }

  // 2. Android Custom WebViews & Injected Interfaces
  const androidBridges = [
    w.AndroidBridge,
    w.AndroidInterface,
    w.Android,
    w.FixHomeApp,
    w.FixHomeAndroid,
    w.JSBridge,
    w.NativeBridge,
    w.App,
    w.HostApp,
    w.MobileApp,
  ];

  for (const bridge of androidBridges) {
    if (!bridge) continue;
    try { if (typeof bridge.callPhone === "function") bridge.callPhone(formattedTel); } catch (err) {}
    try { if (typeof bridge.openDialer === "function") bridge.openDialer(formattedTel); } catch (err) {}
    try { if (typeof bridge.makeCall === "function") bridge.makeCall(formattedTel); } catch (err) {}
    try { if (typeof bridge.call === "function") bridge.call(formattedTel); } catch (err) {}
    try { if (typeof bridge.dial === "function") bridge.dial(formattedTel); } catch (err) {}
    try { if (typeof bridge.openUrl === "function") bridge.openUrl(telUri); } catch (err) {}
    try { if (typeof bridge.launchIntent === "function") bridge.launchIntent(telUri); } catch (err) {}
    try { if (typeof bridge.openUrl === "function") bridge.openUrl(androidIntentUri); } catch (err) {}
  }

  // 3. Capacitor / Cordova / Webkit
  if (w.Capacitor?.Plugins?.App?.openUrl) {
    try { w.Capacitor.Plugins.App.openUrl({ url: telUri }); } catch (err) {}
  }
  if (w.cordova?.InAppBrowser) {
    try { w.cordova.InAppBrowser.open(telUri, "_system"); } catch (err) {}
  }
  if (w.webkit?.messageHandlers) {
    try {
      if (w.webkit.messageHandlers.callPhone) {
        w.webkit.messageHandlers.callPhone.postMessage({ number: formattedTel, url: telUri });
      }
      if (w.webkit.messageHandlers.openUrl) {
        w.webkit.messageHandlers.openUrl.postMessage({ url: telUri });
      }
    } catch (err) {}
  }

  // 4. Hidden Iframe trigger (classic Android WebView workaround that forces shouldOverrideUrlLoading)
  try {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.src = telUri;
    document.body.appendChild(iframe);
    setTimeout(() => {
      try { document.body.removeChild(iframe); } catch (e) {}
    }, 1500);
  } catch (err) {}

  // 5. Dynamic Anchor element click with target="_blank"
  try {
    const a = document.createElement("a");
    a.href = telUri;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { document.body.removeChild(a); } catch (e) {}
    }, 300);
  } catch (err) {}

  // 6. Direct window.location.href & Android Intent fallback
  try {
    window.location.href = telUri;
  } catch (err) {
    try {
      window.location.href = androidIntentUri;
    } catch (e) {
      try {
        window.open(telUri, "_system");
      } catch (e2) {}
    }
  }
}

export function exitNativeApp() {
  logNav("NativeBridge", "exitNativeApp() invoked", {
    timestamp: new Date().toISOString(),
    historyState: typeof window !== "undefined" ? window.history.state : null,
    historyLength: typeof window !== "undefined" ? window.history.length : 0,
  });

  notifyNativeBackState(false);

  try {
    if (typeof window !== "undefined") {
      const w = window as any;

      // 1. React Native WebView
      if (w.ReactNativeWebView?.postMessage) {
        w.ReactNativeWebView.postMessage(JSON.stringify({ action: "exitApp", type: "EXIT_APP" }));
        w.ReactNativeWebView.postMessage("exitApp");
        w.ReactNativeWebView.postMessage("close");
      }

      // 2. Android Custom WebViews & Injected Interfaces
      const androidBridges = [
        w.AndroidBridge,
        w.AndroidInterface,
        w.Android,
        w.FixHomeApp,
        w.FixHomeAndroid,
        w.JSBridge,
        w.NativeBridge,
        w.App,
        w.HostApp,
        w.MobileApp,
      ];

      for (const bridge of androidBridges) {
        if (!bridge) continue;
        try { if (typeof bridge.exitApp === "function") bridge.exitApp(); } catch (err) {}
        try { if (typeof bridge.closeApp === "function") bridge.closeApp(); } catch (err) {}
        try { if (typeof bridge.finish === "function") bridge.finish(); } catch (err) {}
        try { if (typeof bridge.close === "function") bridge.close(); } catch (err) {}
        try { if (typeof bridge.exit === "function") bridge.exit(); } catch (err) {}
        try { if (typeof bridge.moveTaskToBack === "function") bridge.moveTaskToBack(true); } catch (err) {}
      }

      // 3. Capacitor / Cordova / Webkit
      if (w.Capacitor?.Plugins?.App?.exitApp) {
        try { w.Capacitor.Plugins.App.exitApp(); } catch (err) {}
      }
      if (w.navigator?.app && typeof w.navigator.app.exitApp === "function") {
        try { w.navigator.app.exitApp(); } catch (err) {}
      }
      if (w.webkit?.messageHandlers?.exitApp) {
        try { w.webkit.messageHandlers.exitApp.postMessage({ action: "exitApp" }); } catch (err) {}
      }

      // 4. Browser Close Fallback
      try { window.close(); } catch (err) {}
    }
  } catch (e) {
    logNav("NativeBridge", "Error executing exitNativeApp()", { error: String(e) });
  }
}


