import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { configurarCanalAndroid } from '../services/notifications';

export default function RootLayout() {
  useEffect(() => {
    configurarCanalAndroid();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" backgroundColor="#0d0d0d" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0d0d0d' },
          headerTintColor: '#FFD700',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#0d0d0d' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="resultado/[id]"
          options={{
            title: 'ANÁLISE',
            headerBackTitle: '',
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
