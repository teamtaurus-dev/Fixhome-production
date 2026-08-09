import React, { useRef, useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, StatusBar, BackHandler, Linking, View, Text } from 'react-native';
import { WebView } from 'react-native-webview';

export default function App() {
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [lastMessage, setLastMessage] = useState('none yet');
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      } else {
        return false;
      }
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [canGoBack]);

  const handleMessage = (event) => {
    setMessageCount((c) => c + 1);
    setLastMessage(event.nativeEvent.data);
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data && typeof data.canGoBack === 'boolean') {
        setCanGoBack(data.canGoBack);
      }
    } catch (e) {
      setLastMessage('PARSE ERROR: ' + event.nativeEvent.data);
    }
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
        allowsBackForwardNavigationGestures={true}
        onMessage={handleMessage}
        onNavigationStateChange={(navState) => {
          if (navState.canGoBack !== undefined && navState.canGoBack) {
            setCanGoBack(true);
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
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        padding: 8,
        zIndex: 9999,
      }}>
        <Text style={{ color: '#0f0', fontSize: 11, fontFamily: 'monospace' }}>
          canGoBack: {String(canGoBack)} | messages received: {messageCount}
        </Text>
        <Text style={{ color: '#0f0', fontSize: 10, fontFamily: 'monospace' }} numberOfLines={2}>
          last: {lastMessage}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});
