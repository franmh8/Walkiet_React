import React from 'react';
import { X, Users, Radio, UserCheck, Shield, ChevronRight } from 'lucide-react';
import { Channel, User, Contact } from '../types';

interface ChannelMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel | null;
  currentUser: User | null;
  contacts: Contact[];
  onOpenChannels: () => void;
  onOpenContacts: () => void;
}

export const ChannelMembersModal: React.FC<ChannelMembersModalProps> = ({
  isOpen,
  onClose,
  channel,
  currentUser,
  contacts,
  onOpenChannels,
  onOpenContacts,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-[#0c1527] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#8a1a36]/10 dark:bg-[#eb527c]/15 text-[#8a1a36] dark:text-[#eb527c] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Oficiales en el Canal
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
                {channel?.name || 'Canal General C5i'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Member List */}
        <div className="p-4 space-y-2 overflow-y-auto flex-1">
          {/* Current User */}
          {currentUser && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                  {currentUser.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {currentUser.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                      TÚ
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    [{currentUser.callsign || 'OPERATIVO'}] • {currentUser.unit || 'C5i'}
                  </span>
                </div>
              </div>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            </div>
          )}

          {/* Active Contacts in Channel */}
          {contacts.map((c) => (
            <div
              key={c.id}
              className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold font-mono">
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {c.alias || c.name}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    [{c.callsign}] • {c.unit}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-medium">Activo</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-between gap-2">
          <button
            onClick={() => {
              onClose();
              onOpenChannels();
            }}
            className="flex-1 py-2 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#8a1a36] hover:text-[#8a1a36] transition flex items-center justify-center gap-1.5"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Cambiar Canal</span>
          </button>
          <button
            onClick={() => {
              onClose();
              onOpenContacts();
            }}
            className="flex-1 py-2 px-3 rounded-xl bg-[#8a1a36] dark:bg-[#eb527c] text-white text-xs font-semibold hover:opacity-90 transition flex items-center justify-center gap-1.5 shadow-sm"
          >
            <span>Ver Contactos</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChannelMembersModal;
