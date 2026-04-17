import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

const FRASES = [
  'Identificando Kill Zones...',
  'Caçando sweep de liquidez...',
  'Mapeando Order Blocks...',
  'Detectando Fair Value Gaps...',
  'Verificando BOS e CHoCH...',
  'Calculando zonas Premium/Discount...',
  'Analisando estrutura HTF...',
  'Identificando OTE Zone...',
  'Buscando confluência SMC...',
  'Validando MSS institucional...',
  'Avaliando Breaker Blocks...',
  'Calculando risco/retorno...',
];

export default function LoadingTrader() {
  const [fraseIdx, setFraseIdx] = useState(0);
  const dotAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Rotate phrases
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        setFraseIdx((i) => (i + 1) % FRASES.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      });
    }, 2000);

    // Dot animation
    const dotLoop = Animated.loop(
      Animated.timing(dotAnim, { toValue: 3, duration: 1200, useNativeDriver: false })
    );
    dotLoop.start();

    // Pulse gold circle
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();

    return () => {
      clearInterval(interval);
      dotLoop.stop();
      pulse.stop();
    };
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.circle, { transform: [{ scale: pulseAnim }] }]}>
        <Text style={styles.circleIcon}>📊</Text>
      </Animated.View>

      <Text style={styles.title}>ANALISANDO</Text>

      <Animated.Text style={[styles.frase, { opacity: fadeAnim }]}>
        {FRASES[fraseIdx]}
      </Animated.Text>

      <View style={styles.dotsRow}>
        {[0, 1, 2].map((i) => (
          <AnimatedDot key={i} index={i} />
        ))}
      </View>
    </View>
  );
}

function AnimatedDot({ index }: { index: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(index * 250),
        Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.delay((2 - index) * 250),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.4] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });

  return (
    <Animated.View
      style={[styles.dot, { transform: [{ scale }], opacity }]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d0d0d',
    gap: 20,
  },
  circle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleIcon: {
    fontSize: 44,
  },
  title: {
    color: '#FFD700',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 6,
    fontFamily: 'monospace',
  },
  frase: {
    color: '#aaa',
    fontSize: 15,
    fontFamily: 'monospace',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFD700',
  },
});
