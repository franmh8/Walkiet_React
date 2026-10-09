import React, { useState } from 'react';
import {
  Radio,
  Users,
  ShieldCheck,
  Plus,
  X,
  Search,
  Lock,
  LogIn,
  KeyRound,
  QrCode,
  Share2,
  Copy,
  Check,
  Trash2,
  Camera,
  LogOut,
  Shield,
  Layers,
} from 'lucide-react';
import { useRadio } from '../context/RadioContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Channel } from '../types';
import { QrCodeView } from '../components/QrCodeView';
import { QrScannerModal } from '../components/QrScannerModal';

const CATEGORIES = [
  { id: 'todos', label: 'Todos' },
  { id: 'general', label: 'General' },
  { id: 'emergencia', label: 'Emergencia' },
  { id: 'tactico', label: 'Táctico' },
  { id: 'vialidad', label: 'Vialidad' },
  { id: 'inteligencia', label: 'Inteligencia' },
  { id: 'privados', label: 'Privados' },
];

const CATEGORY_OPTIONS = [
  { id: 'tactico', label: 'Operaciones Especiales Tácticas' },
  { id: 'general', label: 'General / Despacho Central' },
  { id: 'emergencia', label: 'Emergencias 911' },
  { id: 'vialidad', label: 'Vialidad y Tránsito' },
  { id: 'inteligencia', label: 'Inteligencia y Monitoreo' },
];

interface ChannelsScreenProps {
  onNavigateTab: (tab: string) => void;
}

export function ChannelsScreen({ onNavigateTab }: ChannelsScreenProps) {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const {
    channels,
    selectedChannel,
    setSelectedChannel,
    createChannel,
    joinChannel,
    joinChannelByCode,
    deleteChannel,
    leaveChannel,
    availableNetworkChannels,
  } = useRadio();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todos');

  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newCategory, setNewCategory] = useState('tactico');
  const [newIsPrivate, setNewIsPrivate] = useState(false);
  const [createPin, setCreatePin] = useState('1090');

  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinPinInput, setJoinPinInput] = useState('');
  const [targetJoinChannel, setTargetJoinChannel] = useState<Channel | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const [codeModalVisible, setCodeModalVisible] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  const [qrScannerVisible, setQrScannerVisible] = useState(false);
  const [configModalChannel, setConfigModalChannel] = useState<Channel | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);

  // Handle select & switch
  const handleSelectChannel = (chan: Channel) => {
    setSelectedChannel(chan);
    onNavigateTab('PTT');
  };

  // Filter channels
  const filteredChannels = channels.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.access_code && c.access_code.includes(searchTerm));

    if (!matchesSearch) return false;

    if (selectedCategory === 'todos') return true;
    if (selectedCategory === 'privados') return Boolean(c.is_private);
    return c.category === selectedCategory;
  });

  const handleCreateChannelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    await createChannel(newChannelName.trim(), newIsPrivate, newCategory, createPin);
    setNewChannelName('');
    setCreateModalVisible(false);
  };

  const handleJoinExistingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetJoinChannel) return;
    setJoinError(null);

    const res = await joinChannel(targetJoinChannel.id, joinPinInput);
    if (res.success) {
      setJoinModalVisible(false);
      setTargetJoinChannel(null);
      setJoinPinInput('');
      onNavigateTab('PTT');
    } else {
      setJoinError(res.message || 'Código PIN incorrecto');
    }
  };

  const handleJoinByCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    setCodeError(null);

    const res = await joinChannelByCode(inputCode.trim());
    if (res.success) {
      setCodeModalVisible(false);
      setInputCode('');
      onNavigateTab('PTT');
    } else {
      setCodeError(res.message || 'No se encontró canal activo con este código');
    }
  };

  const copyChannelPin = (pin: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(pin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* HEADER */}
      <div
        className="px-5 py-4 border-b flex items-center justify-between"
        style={{
          backgroundColor: colors.headerBackground,
          borderColor: colors.border,
        }}
      >
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            RED DE RADIOCOMUNICACIÓN
          </span>
          <h2 className="text-base md:text-lg font-bold" style={{ color: colors.text }}>
            Canales y Grupos C5i
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCodeModalVisible(true)}
            title="Unirse con Código PIN"
            className="p-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <KeyRound className="w-4 h-4 text-rose-400" />
            <span className="hidden sm:inline">Código</span>
          </button>

          <button
            onClick={() => setQrScannerVisible(true)}
            title="Escanear QR"
            className="p-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition"
          >
            <Camera className="w-4 h-4 text-rose-400" />
          </button>

          <button
            onClick={() => setCreateModalVisible(true)}
            className="py-2 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-rose-950/40 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Canal</span>
          </button>
        </div>
      </div>

      {/* SEARCH & CATEGORIES */}
      <div className="p-4 border-b space-y-3" style={{ borderColor: colors.border }}>
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, código o frecuencia..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              color: colors.text,
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition ${
                  active
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-slate-800/60 border border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* CHANNELS LIST */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {filteredChannels.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Radio className="w-12 h-12 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-400">No se encontraron canales</p>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Crea un nuevo canal o explora los canales tácticos disponibles en la red.
            </p>
            <button
              onClick={() => setJoinModalVisible(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-rose-400 border border-slate-700"
            >
              Ver canales en la red C5i
            </button>
          </div>
        ) : (
          filteredChannels.map((chan) => {
            const isSelected = selectedChannel?.id === chan.id;
            return (
              <div
                key={chan.id}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                  isSelected
                    ? 'border-rose-500 bg-rose-950/20 shadow-md shadow-rose-950/30'
                    : 'hover:border-slate-600'
                }`}
                style={{
                  backgroundColor: isSelected ? undefined : colors.card,
                  borderColor: isSelected ? undefined : colors.cardBorder,
                }}
                onClick={() => handleSelectChannel(chan)}
              >
                {/* Left side details */}
                <div className="flex items-center gap-3.5 truncate">
                  <div
                    className={`p-3 rounded-xl ${
                      isSelected
                        ? 'bg-rose-600 text-white shadow-md'
                        : 'bg-slate-800/80 text-slate-300'
                    }`}
                  >
                    <Radio className="w-5 h-5" />
                  </div>

                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <h4
                        className="font-bold text-sm truncate"
                        style={{ color: colors.text }}
                      >
                        {chan.name}
                      </h4>
                      {chan.is_private ? (
                        <span className="p-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                          <Lock className="w-3 h-3" />
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1 font-mono">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        {chan.member_count || 1} activos
                      </span>
                      <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-slate-800/60 font-mono text-slate-400 border border-slate-700/60">
                        {chan.category || 'TÁCTICO'}
                      </span>
                      {chan.access_code && (
                        <span className="text-[10px] font-mono text-rose-400">
                          PIN: {chan.access_code}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side actions */}
                <div
                  className="flex items-center gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setConfigModalChannel(chan)}
                    title="QR y Ajustes de Canal"
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                  {isSelected && (
                    <span className="hidden sm:inline text-[11px] font-bold text-rose-400 font-mono px-2 py-1 rounded bg-rose-950/60 border border-rose-800/60">
                      SINTONIZADO
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CREATE CHANNEL MODAL */}
      {createModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
            }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">Nuevo Canal Táctico C5i</h3>
              </div>
              <button
                onClick={() => setCreateModalVisible(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateChannelSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nombre del Canal / Frecuencia
                </label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value.toUpperCase())}
                  placeholder="Ej. OPERATIVO SUR PACHUCA"
                  className="w-full px-3.5 py-2.5 text-sm uppercase rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Categoría Operativa
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-medium text-slate-300">
                    Canal Privado (Requiere PIN)
                  </span>
                  <input
                    type="checkbox"
                    checked={newIsPrivate}
                    onChange={(e) => setNewIsPrivate(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                  />
                </label>

                {newIsPrivate && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Código PIN de acceso táctico (4 dígitos)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={createPin}
                      onChange={(e) => setCreatePin(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2 text-sm font-mono tracking-widest text-center rounded-xl bg-slate-950 border border-slate-700 text-rose-400 focus:outline-none focus:border-rose-500"
                      placeholder="1090"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalVisible(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition"
                >
                  Crear y Sintonizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN BY CODE MODAL */}
      {codeModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
            }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">Unirse con PIN</h3>
              </div>
              <button
                onClick={() => setCodeModalVisible(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleJoinByCodeSubmit} className="p-6 space-y-4">
              {codeError && (
                <div className="p-3 text-xs rounded-xl bg-rose-950/40 border border-rose-800 text-rose-400">
                  {codeError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Ingresa el código PIN del canal (4 dígitos)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="Ej. 1090"
                  className="w-full px-4 py-3 text-lg font-mono tracking-widest text-center rounded-xl bg-slate-900 border border-slate-700 text-rose-400 focus:outline-none focus:border-rose-500"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCodeModalVisible(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 text-sm hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!inputCode.trim()}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition disabled:opacity-40"
                >
                  Conectar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHANNEL CONFIG & QR CODE MODAL */}
      {configModalChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
            }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-white truncate max-w-[200px]">
                  {configModalChannel.name}
                </h3>
              </div>
              <button
                onClick={() => setConfigModalChannel(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center text-center space-y-4">
              {/* QR Code */}
              <div className="p-3 rounded-2xl bg-white shadow-xl">
                <QrCodeView
                  value={`C5I:${configModalChannel.id}:${configModalChannel.access_code || 'PUBLIC'}`}
                  size={180}
                  fgColor="#0f172a"
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-300">
                  Código QR de Enlace de Frecuencia
                </p>
                <p className="text-[11px] text-slate-400">
                  Otros oficiales pueden escanear este código o ingresar el PIN
                </p>
              </div>

              {/* PIN Code Box */}
              <div className="w-full p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block text-left">PIN DE ACCESO:</span>
                  <span className="text-base font-mono font-bold text-rose-400">
                    {configModalChannel.access_code || 'SIN PIN'}
                  </span>
                </div>
                <button
                  onClick={() => copyChannelPin(configModalChannel.access_code || configModalChannel.id)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition"
                >
                  {copiedPin ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedPin ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>

              {/* Delete / Leave button */}
              <button
                onClick={() => {
                  deleteChannel(configModalChannel.id);
                  setConfigModalChannel(null);
                }}
                className="w-full py-2.5 rounded-xl border border-rose-900/50 hover:bg-rose-950/30 text-rose-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar de mis Canales
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner */}
      <QrScannerModal
        visible={qrScannerVisible}
        onClose={() => setQrScannerVisible(false)}
        onScanned={(code) => {
          handleJoinByCodeSubmit({ preventDefault: () => {} } as any);
        }}
      />
    </div>
  );
}

export default ChannelsScreen;
