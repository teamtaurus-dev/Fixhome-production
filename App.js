import React, { useRef, useEffect } from 'react';
import { SafeAreaView, StyleSheet, StatusBar, BackHandler, Linking } from 'react-native';
import { WebView } from 'react-native-webview';

export default function App() {
  const webViewRef = useRef(null);

  useEffect(() => {
    const onBackPress = () => {
      if (webViewRef.current) {
        // Forward hardware back directly and exclusively to the web app
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
    return () => backHandler.remove();
  }, []);

  const handleMessage = (event) => {
    try {
      const dataStr = event.nativeEvent.data;
      if (dataStr === 'exitApp' || dataStr === 'close') {
        BackHandler.exitApp();
        return;
      }
      const data = JSON.parse(dataStr);
      if (data && (data.action === 'exitApp' || data.type === 'EXIT_APP')) {
        BackHandler.exitApp();
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

