import React, { useRef, useEffect } from 'react';
import { SafeAreaView, StyleSheet, StatusBar, BackHandler, Linking, ToastAndroid, Platform, AppState } from 'react-native';
import { WebView } from 'react-native-webview';

export default function App() {
  const webViewRef = useRef(null);
  const lastBackPressRef = useRef(0);
  const isNavigatingSubViewRef = useRef(false);

  useEffect(() => {
    // Whenever app is resumed/opened/foregrounded, tell webview to reset exit timer
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && webViewRef.current) {
        lastBackPressRef.current = 0;
        webViewRef.current.injectJavaScript(`
          (function() {
            try {
              if (typeof window.__resetExitTimer === 'function') {
                window.__resetExitTimer();
              }
            } catch (e) {}
          })();
          true;
        `);
      }
    });

    const onBackPress = () => {
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          (function() {
            try {
              if (typeof window.__handleHardwareBack === 'function') {
                window.__handleHardwareBack();
              }
            } catch (err) {}
          })();
          true;
        `);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => {
      backHandler.remove();
      subscription.remove();
    };
  }, []);

  const handleMessage = (event) => {
    try {
      const dataStr = event.nativeEvent.data;
      if (dataStr === 'exitApp' || dataStr === 'close' || dataStr === 'EXIT_APP') {
        BackHandler.exitApp();
        return;
      }
      const data = JSON.parse(dataStr);
      if (data) {
        if (data.action === 'exitApp' || data.type === 'EXIT_APP') {
          BackHandler.exitApp();
        } else if (data.action === 'showToast' || data.type === 'SHOW_TOAST') {
          if (Platform.OS === 'android') {
            ToastAndroid.show(data.message || 'Press back again to exit FixHome', ToastAndroid.SHORT);
          }
        }
      }
    } catch (e) {}
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <WebView 
        ref={webViewRef}
        source={{ uri: 'https://ais-pre-x7qi7p7a2guycv454py3ea-365176060634.asia-east1.run.app' }} 
        style={{ flex: 1 }}
        domStorageEnabled={true}
        javaScriptEnabled={true}
        allowsBackForwardNavigationGestures={false}
        onMessage={handleMessage}
        onLoadEnd={() => {
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(`
              (function() {
                try {
                  if (typeof window.__syncNativeBackState === 'function') {
                    window.__syncNativeBackState();
                  }
                } catch (e) {}
              })();
              true;
            `);
          }
        }}
        onShouldStartLoadWithRequest={(request) => {
          const { url } = request;
          if (
            url.startsWith('tel:') ||
            url.startsWith('mailto:') ||
            url.startsWith('whatsapp:') ||
            url.startsWith('sms:')
          ) {
            Linking.openURL(url).catch(() => {});
            return false;
          }
          return true;
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});




