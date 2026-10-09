import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Shield,
  MessageSquare,
  Radio,
  AlertTriangle,
  Trash2,
  CheckCheck,
} from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { useRadio } from '../context/RadioContext';
import { useTheme } from '../context/ThemeContext';

const QUICK_CODES = [
  '10-4 Entendido y copiado',
  'Sector despejado sin novedad',
  '10-20 Ubicación confirmada',
  '10-33 Emergencia en progreso',
  'Solicito relevo de unidad',
];

export function ChatScreen() {
  const { user } = useAuth();
  const { selectedChannel } = useRadio();
  const { messages, sendMessage, clearMessages } = useChat();
  const { colors, isDark } = useTheme();

  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(inputText.trim(), selectedChannel?.id);
    setInputText('');
  };

  const handleSendQuick = (code: string) => {
    sendMessage(code, selectedChannel?.id);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* HEADER */}
      <div
        className="px-5 py-3.5 border-b flex items-center justify-between"
        style={{
          backgroundColor: colors.headerBackground,
          borderColor: colors.border,
        }}
      >
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            CHAT Y DESPACHO TÁCTICO
          </span>
          <h2 className="text-sm md:text-base font-bold truncate max-w-[240px] md:max-w-md" style={{ color: colors.text }}>
            {selectedChannel ? selectedChannel.name : 'Canal General C5i'}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Encrypted indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-800/40 text-[11px] font-semibold text-emerald-400">
            <Shield className="w-3 h-3 text-emerald-400" />
            <span>Cifrado</span>
          </div>

          <button
            onClick={clearMessages}
            title="Limpiar registro de chat"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MESSAGES LOG */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 text-slate-500">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-semibold text-slate-300">Canal de mensajes limpio</h3>
            <p className="text-xs text-slate-400 max-w-xs">
              No hay reportes previos en esta frecuencia. Envía un reporte o texto táctico a las unidades.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;
            const isEmergency = msg.type === 'emergency';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in duration-150`}
              >
                {/* Sender Tag */}
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    {msg.sender_callsign || msg.sender_name || 'OFICIAL'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[85%] md:max-w-[70%] p-3.5 rounded-2xl text-xs md:text-sm shadow-sm ${
                    isEmergency
                      ? 'bg-rose-950/80 border border-rose-700 text-rose-200'
                      : isMe
                      ? 'bg-rose-700 text-white rounded-br-xs'
                      : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-xs'
                  }`}
                >
                  {isEmergency && (
                    <div className="flex items-center gap-1.5 text-rose-400 font-bold text-[11px] mb-1 font-mono uppercase">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      ALERTA DE EMERGENCIA C5I
                    </div>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>

                  <div className={`mt-1 flex items-center justify-end text-[10px] ${isMe ? 'text-rose-200' : 'text-slate-400'}`}>
                    <CheckCheck className="w-3 h-3 ml-1" />
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* QUICK PRESETS */}
      <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/40 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px]">
        {QUICK_CODES.map((code, idx) => (
          <button
            key={idx}
            onClick={() => handleSendQuick(code)}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono whitespace-nowrap border border-slate-700/80 transition"
          >
            {code}
          </button>
        ))}
      </div>

      {/* INPUT BAR */}
      <form
        onSubmit={handleSend}
        className="p-3 border-t flex items-center gap-2"
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
        }}
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Reporte a ${selectedChannel ? selectedChannel.name : 'canal'}...`}
          className="flex-1 px-4 py-2.5 text-sm rounded-xl border text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            color: colors.text,
          }}
        />

        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-semibold transition active:scale-95 shadow-md shadow-rose-950/40"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

export default ChatScreen;
