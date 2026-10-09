import React, { useState, useEffect } from 'react';
import {
  User,
  Phone,
  Plus,
  X,
  Search,
  Radio,
  RadioTower,
  Shield,
  CheckCircle,
} from 'lucide-react';
import { Contact } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useRadio } from '../context/RadioContext';

const DEFAULT_TACTICAL_CONTACTS: Contact[] = [
  {
    id: 'cnt-1',
    name: 'Comandante R. Morales',
    phone_number: '7711234567',
    callsign: 'HALCON-01',
    unit: 'Fuerza Especial de Reacción C5i',
    status: 'online',
  },
  {
    id: 'cnt-2',
    name: 'Oficial Karla Mendoza',
    phone_number: '7719876543',
    callsign: 'PATRULLA-04',
    unit: 'Sector Pachuca Sur',
    status: 'online',
  },
  {
    id: 'cnt-3',
    name: 'Oficial Diego Navarrete',
    phone_number: '7714567890',
    callsign: 'COBRA-09',
    unit: 'Vialidad y Tránsito Estatal',
    status: 'online',
  },
  {
    id: 'cnt-4',
    name: 'Despacho Central 911',
    phone_number: '7710009911',
    callsign: 'CENTRAL-C5I',
    unit: 'Centro de Comando y Control C5i',
    status: 'online',
  },
  {
    id: 'cnt-5',
    name: 'Oficial Andrea Trejo',
    phone_number: '7713451234',
    callsign: 'DELTA-03',
    unit: 'Sector Pachuca Norte',
    status: 'offline',
  },
];

interface ContactsScreenProps {
  onNavigateTab: (tab: string) => void;
}

export function ContactsScreen({ onNavigateTab }: ContactsScreenProps) {
  const { colors, isDark } = useTheme();
  const { setSelectedContact } = useRadio();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [callsign, setCallsign] = useState('');
  const [phone, setPhone] = useState('');
  const [unit, setUnit] = useState('Sector Operativo Hidalgo');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('c5i_contacts');
      if (stored) {
        setContacts(JSON.parse(stored));
      } else {
        setContacts(DEFAULT_TACTICAL_CONTACTS);
        localStorage.setItem('c5i_contacts', JSON.stringify(DEFAULT_TACTICAL_CONTACTS));
      }
    } catch {
      setContacts(DEFAULT_TACTICAL_CONTACTS);
    }
  }, []);

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Ingresa el nombre del oficial.');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setFormError('El teléfono celular debe contener exactamente 10 dígitos.');
      return;
    }

    const newContact: Contact = {
      id: `cnt-${Date.now()}`,
      name: name.trim(),
      phone_number: cleanPhone,
      callsign: callsign.trim().toUpperCase() || `PATRULLA-${cleanPhone.slice(-3)}`,
      unit: unit.trim(),
      status: 'online',
    };

    const updated = [newContact, ...contacts];
    setContacts(updated);
    localStorage.setItem('c5i_contacts', JSON.stringify(updated));

    setModalVisible(false);
    setName('');
    setCallsign('');
    setPhone('');
  };

  const handleConnectRadio = (c: Contact) => {
    setSelectedContact(c);
    onNavigateTab('PTT');
  };

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.callsign.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone_number.includes(searchTerm)
  );

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
            DIRECTORIO OPERATIVO
          </span>
          <h2 className="text-base md:text-lg font-bold" style={{ color: colors.text }}>
            Contactos C5i
          </h2>
        </div>

        <button
          onClick={() => setModalVisible(true)}
          className="py-2 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-rose-950/40 transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar Oficial</span>
        </button>
      </div>

      {/* SEARCH */}
      <div className="p-4 border-b" style={{ borderColor: colors.border }}>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, indicativo o teléfono..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              color: colors.text,
            }}
          />
        </div>
      </div>

      {/* CONTACTS LIST */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {filteredContacts.length === 0 ? (
          <div className="text-center py-12 space-y-2 text-slate-400">
            <User className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">No se encontraron contactos</p>
            <p className="text-xs">Agrega personal de seguridad o modifica tu búsqueda.</p>
          </div>
        ) : (
          filteredContacts.map((c) => {
            const isOnline = c.status === 'online';
            return (
              <div
                key={c.id}
                className="p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 hover:border-slate-700"
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                }}
              >
                <div className="flex items-center gap-3 truncate">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-sm">
                      {c.callsign.slice(0, 2)}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                        isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                      }`}
                    />
                  </div>

                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm truncate" style={{ color: colors.text }}>
                        {c.name}
                      </h4>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-400 border border-rose-800/60 font-bold">
                        {c.callsign}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span className="truncate">{c.unit}</span>
                      <span className="font-mono text-[11px] text-slate-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {c.phone_number}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Direct Action */}
                <button
                  onClick={() => handleConnectRadio(c)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/60 hover:text-rose-300 hover:border-rose-700 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Enlace</span>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* ADD CONTACT MODAL */}
      {modalVisible && (
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
                <User className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">Agregar Oficial al Directorio</h3>
              </div>
              <button
                onClick={() => setModalVisible(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddContact} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 text-xs rounded-xl bg-rose-950/40 border border-rose-800 text-rose-400">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Oficial Fernando Ramos"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Indicativo (Callsign)</label>
                  <input
                    type="text"
                    value={callsign}
                    onChange={(e) => setCallsign(e.target.value.toUpperCase())}
                    placeholder="Ej. JAGUAR-01"
                    className="w-full px-3.5 py-2.5 text-sm uppercase rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Teléfono (10 dígitos)</label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej. 7715551234"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Sector / Unidad</label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalVisible(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 text-sm hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition"
                >
                  Guardar Contacto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContactsScreen;
