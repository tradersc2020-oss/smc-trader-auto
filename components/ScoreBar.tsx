import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ScoreBarProps {
  score: number;
}

function getScoreColors(score: number): [string, string] {
  if (score >= 90) return ['#FFD700', '#FFA500'];
  if (score >= 75) return ['#00C896', '#00A878'];
  if (score >= 50) return ['#FFA500', '#FF8C00'];
  return ['#FF4444', '#CC0000'];
}

function getScoreLabel(score: number): string {
  if (score >= 90) return '🔥 ENTRADA FORTE';
  if (score >= 75) return '✅ OPERAR';
  if (score >= 50) return '⚠️ AGUARDAR';
  return '❌ NÃO OPERAR';
}

export default function ScoreBar({ score }: ScoreBarProps) {
  const animWidth = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const clampedScore = Math.min(100, Math.max(0, score));
  const colors = getScoreColors(clampedScore);
  const label = getScoreLabel(clampedScore);

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: clampedScore,
      duration: 1000,
      useNativeDriver: false,
    }).start();

    if (clampedScore >= 90) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [clampedScore]);

  const widthPercent = animWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, clampedScore >= 90 && { transform: [{ scale: pulseAnim }] }]}>
      <View style={styles.header}>
        <Text style={styles.labelText}>{label}</Text>
        <Text style={[styles.scoreText, { color: colors[0] }]}>{clampedScore}/100</Text>
      </View>

      <View style={styles.barBg}>
        <Animated.View style={[styles.barFill, { width: widthPercent }]}>
          <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>

      <Text style={[styles.confluence, { color: colors[0] }]}>
        Confluência: {clampedScore}/100
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  labelText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scoreText: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  barBg: {
    height: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
    overflow: 'hidden',
  },
  confluence: {
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'right',
  },
});
