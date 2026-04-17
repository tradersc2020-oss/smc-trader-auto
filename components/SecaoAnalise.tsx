import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MarkdownText from './MarkdownText';

interface SecaoAnaliseProps {
  emoji: string;
  titulo: string;
  conteudo: string;
  corBorda?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export default function SecaoAnalise({
  emoji,
  titulo,
  conteudo,
  corBorda = '#2a2a2a',
  collapsible = false,
  defaultCollapsed = false,
}: SecaoAnaliseProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  // Remove a linha de cabeçalho do conteúdo (emoji + título)
  const lines = conteudo.split('\n').filter(l => {
    const trimmed = l.trim();
    if (!trimmed) return true;
    if (trimmed.startsWith(emoji)) return false;
    if (trimmed.toUpperCase().includes(titulo.toUpperCase()) && trimmed.length < titulo.length + 10) return false;
    return true;
  });
  const displayContent = lines.join('\n').trim();

  return (
    <View style={[styles.card, { borderLeftColor: corBorda }]}>
      <TouchableOpacity
        style={styles.header}
        onPress={collapsible ? () => setCollapsed(!collapsed) : undefined}
        activeOpacity={collapsible ? 0.7 : 1}
      >
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={[styles.titulo, { color: corBorda === '#2a2a2a' ? '#FFD700' : corBorda }]}>
          {titulo}
        </Text>
        {collapsible && (
          <Text style={styles.chevron}>{collapsed ? '▶' : '▼'}</Text>
        )}
      </TouchableOpacity>

      {!collapsed && (
        <View style={styles.conteudoBox}>
          {displayContent ? (
            <MarkdownText text={displayContent} baseColor="#bbb" fontSize={13} />
          ) : (
            <Text style={styles.vazio}>—</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  emoji: {
    fontSize: 17,
  },
  titulo: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    flex: 1,
    textTransform: 'uppercase',
  },
  chevron: {
    color: '#555',
    fontSize: 11,
  },
  conteudoBox: {
    paddingTop: 2,
  },
  vazio: {
    color: '#444',
    fontSize: 13,
    fontFamily: 'monospace',
  },
});
