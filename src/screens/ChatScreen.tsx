import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { useRadio } from '../context/RadioContext';
import { useTheme } from '../context/ThemeContext';
import { Send, Shield, MessageSquare, Radio } from 'lucide-react-native';

export function ChatScreen() {
  const { user } = useAuth();
  const { selectedChannel } = useRadio();
  const { messages, sendMessage } = useChat();
  const { colors, isDark } = useTheme();
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage(inputText, selectedChannel?.id);
    setInputText('');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerLabel, { color: colors.textMuted }]}>
            CHAT Y DESPACHO
          </Text>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {selectedChannel ? selectedChannel.name : 'Canal General C5i'}
          </Text>
        </View>
        <View
          style={[
            styles.shieldPill,
            {
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
              borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0',
            },
          ]}
        >
          <Shield color="#10b981" size={13} />
          <Text style={styles.shieldText}>Cifrado</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: colors.badgeBackground, borderColor: colors.badgeBorder },
              ]}
            >
              <MessageSquare color={colors.textMuted} size={32} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Canal de mensajes limpio
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              No hay mensajes previos en esta frecuencia. Envía un reporte o texto al equipo.
            </Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => {
              const isMe = item.sender_id === user?.id;
              return (
                <View
                  style={[
                    styles.bubbleContainer,
                    isMe ? styles.bubbleRight : styles.bubbleLeft,
                  ]}
                >
                  <Text
                    style={[
                      styles.senderName,
                      { color: colors.textMuted, textAlign: isMe ? 'right' : 'left' },
                    ]}
                  >
                    {item.sender_callsign || item.sender_name || 'Oficial'}
                  </Text>
                  <View
                    style={[
                      styles.bubble,
                      isMe
                        ? [
                            styles.bubbleMe,
                            {
                              backgroundColor: colors.primary,
                              borderBottomRightRadius: 4,
                            },
                          ]
                        : [
                            styles.bubbleThem,
                            {
                              backgroundColor: colors.card,
                              borderColor: colors.cardBorder,
                              borderBottomLeftRadius: 4,
                            },
                          ],
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        { color: isMe ? '#ffffff' : colors.text },
                      ]}
                    >
                      {item.text}
                    </Text>
                    <Text
                      style={[
                        styles.timestamp,
                        {
                          color: isMe
                            ? 'rgba(255,255,255,0.7)'
                            : colors.textMuted,
                        },
                      ]}
                    >
                      {new Date(item.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Input Bar */}
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.inputBorder,
              },
            ]}
          >
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Escribe un mensaje de radio..."
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { color: colors.text }]}
              multiline
            />
          </View>
          <Pressable
            onPress={handleSend}
            disabled={!inputText.trim()}
            style={[
              styles.sendButton,
              {
                backgroundColor: inputText.trim()
                  ? colors.primary
                  : colors.badgeBackground,
              },
            ]}
          >
            <Send
              color={inputText.trim() ? '#ffffff' : colors.textMuted}
              size={18}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 14 : 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 2,
    letterSpacing: -0.4,
  },
  shieldPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  shieldText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  bubbleContainer: {
    marginBottom: 12,
    maxWidth: '82%',
  },
  bubbleRight: {
    alignSelf: 'flex-end',
  },
  bubbleLeft: {
    alignSelf: 'flex-start',
  },
  senderName: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 3,
    paddingHorizontal: 4,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleMe: {},
  bubbleThem: {},
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 9,
    marginTop: 4,
    textAlign: 'right',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  inputWrapper: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    maxHeight: 100,
  },
  input: {
    fontSize: 14,
    minHeight: 24,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
