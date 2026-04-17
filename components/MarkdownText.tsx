import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

interface MarkdownTextProps {
  text: string;
  baseColor?: string;
  fontSize?: number;
}

/**
 * Renderiza texto com suporte básico a Markdown:
 * - **negrito** → texto em branco brilhante
 * - linhas com "- " → bullet point
 * - linhas "---" → removidas
 * - linhas "##" → título dourado
 */
export default function MarkdownText({
  text,
  baseColor = '#ccc',
  fontSize = 13,
}: MarkdownTextProps) {
  // Remove separadores e linhas vazias excessivas
  const lines = text
    .split('\n')
    .map(l => l.trimEnd())
    .filter((l, i, arr) => {
      if (/^[-─—]{3,}$/.test(l.trim())) return false;
      if (l.trim() === '##' || l.trim() === '#') return false;
      // Colapsar mais de 1 linha vazia consecutiva
      if (l.trim() === '' && arr[i - 1]?.trim() === '') return false;
      return true;
    });

  return (
    <View>
      {lines.map((line, i) => {
        const trimmed = line.trim();

        // Linha vazia → espaço pequeno
        if (!trimmed) {
          return <View key={i} style={{ height: 4 }} />;
        }

        // Heading ## → dourado
        if (/^#{1,4}\s/.test(trimmed)) {
          const heading = trimmed.replace(/^#{1,4}\s+/, '');
          return (
            <Text key={i} style={[styles.heading, { fontSize: fontSize + 1 }]}>
              {renderInline(heading, baseColor, fontSize + 1)}
            </Text>
          );
        }

        // Bullet point "- " ou "• "
        if (/^[-•]\s/.test(trimmed)) {
          const content = trimmed.replace(/^[-•]\s+/, '');
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={[styles.bullet, { color: '#FFD700', fontSize }]}>•</Text>
              <Text style={[styles.bulletText, { color: baseColor, fontSize, lineHeight: fontSize * 1.6 }]}>
                {renderInline(content, baseColor, fontSize)}
              </Text>
            </View>
          );
        }

        // Linha normal com possível bold inline
        return (
          <Text key={i} style={[styles.line, { color: baseColor, fontSize, lineHeight: fontSize * 1.6 }]}>
            {renderInline(trimmed, baseColor, fontSize)}
          </Text>
        );
      })}
    </View>
  );
}

/**
 * Processa negrito **texto** dentro de uma linha.
 * Retorna array de <Text> components.
 */
function renderInline(
  line: string,
  baseColor: string,
  fontSize: number
): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    // Texto antes do bold
    if (match.index > last) {
      parts.push(
        <Text key={`t${last}`} style={{ color: baseColor, fontSize }}>
          {line.slice(last, match.index)}
        </Text>
      );
    }
    // Texto bold/italic
    const boldText = match[1] || match[2];
    parts.push(
      <Text
        key={`b${match.index}`}
        style={{ color: '#fff', fontWeight: '700', fontSize }}
      >
        {boldText}
      </Text>
    );
    last = match.index + match[0].length;
  }

  // Resto após último match
  if (last < line.length) {
    parts.push(
      <Text key={`t${last}`} style={{ color: baseColor, fontSize }}>
        {line.slice(last)}
      </Text>
    );
  }

  return parts.length > 0 ? parts : line;
}

const styles = StyleSheet.create({
  line: {
    marginBottom: 2,
    fontFamily: 'monospace',
  },
  heading: {
    color: '#FFD700',
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2,
    gap: 6,
  },
  bullet: {
    lineHeight: 21,
    fontWeight: '700',
  },
  bulletText: {
    flex: 1,
    fontFamily: 'monospace',
  },
});
