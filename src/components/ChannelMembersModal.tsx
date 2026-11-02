import React from 'react';
import { X, Users, Plus } from 'lucide-react';
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

  const channelName = channel?.name || 'Canal Táctico';
  const memberCount = (contacts.length > 0 ? contacts.length : 0) + (currentUser ? 1 : 0);
  const activeCount = memberCount > 0 ? memberCount : 1;

  const currentUserName = currentUser?.name || 'Francisco';
  const initial = currentUserName.charAt(0).toUpperCase() || 'F';
  const callsign = currentUser?.callsign || currentUser?.badge || 'RADI0-8448';
  const unit = currentUser?.unit || 'Sector Operativo Hidalgo';
  const role = currentUser?.role || 'Operador';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white dark:bg-[#0c1527] border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header matching Image 3 */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {channelName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {activeCount} {activeCount === 1 ? 'usuario activo' : 'usuarios activos'} • General
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Member List matching Image 3 */}
        <div className="p-4 space-y-2.5 max-h-[55vh] overflow-y-auto">
          {/* Current User Card */}
          <div className="p-3.5 rounded-2xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar with status indicator dot */}
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-sm">
                  {initial}
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0c1527]" />
              </div>

              {/* Name & Callsign */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {currentUserName} (Tú)
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#8a1a36] text-white font-black tracking-wide">
                    TÚ
                  </span>
                </div>
                <p className="text-xs text-rose-700 dark:text-rose-400 font-medium truncate mt-0.5">
                  <span className="font-semibold">{callsign}</span> • {unit}
                </p>
              </div>
            </div>

            {/* Role pill */}
            <div className="shrink-0 ml-2">
              <span className="px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 font-medium bg-white dark:bg-slate-900 shadow-2xs">
                {role}
              </span>
            </div>
          </div>

          {/* Other Members if any */}
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="p-3 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs">
                    {(contact.alias || contact.name || 'O').charAt(0).toUpperCase()}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0c1527]" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                    {contact.alias || contact.name}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                    {contact.callsign} • {contact.unit}
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                Oficial
              </span>
            </div>
          ))}
        </div>

        {/* Footer actions matching Image 3: "+ Gestionar Contactos" on left, "Cerrar" on right */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            onClick={() => {
              onClose();
              onOpenContacts();
            }}
            className="text-xs font-bold text-[#8a1a36] dark:text-[#eb527c] hover:underline flex items-center gap-1 cursor-pointer transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Gestionar Contactos</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChannelMembersModal;
