import { logNav } from "./navLogger";

export function notifyNativeBackState() {
  try {
    const st = window.history.state || {};
    // Keep canGoBack=true and isRoot=false so native Android wrapper forwards hardware back events to JS for 2-tap exit handling
    const canGoBack = true;
    const isRoot = false;
    if ((window as any).ReactNativeWebView?.postMessage) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify({ canGoBack: true, isRoot: false, action: "backStateUpdate", type: "NAV_STATE" }));
    }
    if ((window as any).AndroidInterface?.setCanGoBack) {
      (window as any).AndroidInterface.setCanGoBack(true);
    }
    if ((window as any).Android?.setCanGoBack) {
      (window as any).Android.setCanGoBack(true);
    }
    if ((window as any).FixHomeApp?.setCanGoBack) {
      (window as any).FixHomeApp.setCanGoBack(true);
    }
  } catch (e) {}
}

export function exitNativeApp() {
  logNav("NativeBridge", "exitNativeApp() invoked", {
    timestamp: new Date().toISOString(),
    historyState: window.history.state,
    historyLength: window.history.length,
    hasReactNativeWebView: Boolean((window as any).ReactNativeWebView?.postMessage),
    hasAndroidInterface: Boolean((window as any).AndroidInterface?.exitApp),
    hasAndroid: Boolean((window as any).Android?.exitApp),
    hasFixHomeApp: Boolean((window as any).FixHomeApp?.exitApp),
    hasCordovaNavigator: Boolean((window as any).navigator?.app?.exitApp),
    hasWebkitHandler: Boolean((window as any).webkit?.messageHandlers?.exitApp),
  });

  try {
    if ((window as any).ReactNativeWebView?.postMessage) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify({ action: "exitApp", type: "EXIT_APP" }));
    }
    if ((window as any).AndroidInterface?.exitApp) {
      (window as any).AndroidInterface.exitApp();
    }
    if ((window as any).Android?.exitApp) {
      (window as any).Android.exitApp();
    }
    if ((window as any).FixHomeApp?.exitApp) {
      (window as any).FixHomeApp.exitApp();
    }
    if ((window as any).navigator && (window as any).navigator.app && typeof (window as any).navigator.app.exitApp === "function") {
      (window as any).navigator.app.exitApp();
    }
    if ((window as any).webkit?.messageHandlers?.exitApp) {
      (window as any).webkit.messageHandlers.exitApp.postMessage({ action: "exitApp" });
    }
    window.close();
  } catch (e) {
    logNav("NativeBridge", "Error executing exitNativeApp()", { error: String(e) });
  }
}

