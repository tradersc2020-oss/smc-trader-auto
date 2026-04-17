import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { enviarTelegramComEA } from '../services/telegramApi';
import { Analise } from '../types/analise';

interface TelegramButtonProps {
  analise: Analise;
  botToken: string;
  chatId: string;
  onSuccess?: () => void;
}

export default function TelegramButton({
  analise,
  botToken,
  chatId,
  onSuccess,
}: TelegramButtonProps) {
  const [sending, setSending] = useState(false);

  const handleEnviar = async () => {
    if (!botToken || !chatId) {
      Alert.alert('Configuração', 'Configure o BOT TOKEN e CHAT ID nas configurações.');
      return;
    }
    setSending(true);
    try {
      await enviarTelegramComEA(botToken, chatId, analise);
      Alert.alert('✅ Enviado para o Telegram');
      onSuccess?.();
    } catch (err: any) {
      Alert.alert('Erro', `Não foi possível enviar: ${err?.message || 'Erro desconhecido'}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.btn, sending && styles.btnDisabled]}
      onPress={handleEnviar}
      disabled={sending}
      activeOpacity={0.7}
    >
      {sending ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={styles.text}>📤 Enviar para Telegram</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#1a6ab5',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: '#2a8fe5',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
