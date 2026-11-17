import { useCallback, useEffect, useRef, useState } from 'react';
import type { Channel } from '../../services/channelsApi';
import type { ChannelsDirectory } from './useChannelsDirectory';
import { readChannelSelection, writeChannelSelection, type ChannelIdentity } from './channelSelectionStorage';

export function useChannelSelection(server: string, user: ChannelIdentity | null, directory: ChannelsDirectory) {
  const scope = directory.scope;
  const active = useRef(scope); active.current = scope;
  const identity = useRef(user); identity.current = user;
  const revision = useRef(0);
  const [preference, setPreference] = useState<{ scope: string; ready: boolean; id: string | null }>({ scope: '', ready: false, id: null });
  const [saveError, setSaveError] = useState<{ scope: string; message: string } | null>(null);
  const written = useRef('');
  useEffect(() => {
    let cancelled = false;
    const version = ++revision.current;
    written.current = ''; setSaveError(null);
    setPreference({ scope, ready: false, id: null });
    const current = identity.current;
    if (!current) return;
    void readChannelSelection(server, current).then(id => {
      if (!cancelled && active.current === scope && version === revision.current) setPreference({ scope, ready: true, id });
    }).catch(() => {
      if (!cancelled && active.current === scope && version === revision.current) {
        setPreference({ scope, ready: true, id: null });
        setSaveError({ scope, message: 'No se pudo leer el último canal de este dispositivo. Se recuperarán tus grupos del servidor.' });
      }
    });
    return () => { cancelled = true; };
  }, [scope, server]);
  const persist = useCallback(async (channel: Channel | null, forgetLegacy = false) => {
    const current = identity.current;
    if (!current || active.current !== scope) return;
    try {
      await writeChannelSelection(server, current, channel, forgetLegacy);
      if (active.current === scope) setSaveError(null);
    } catch (error) {
      if (active.current === scope) setSaveError({ scope, message: 'No se pudo guardar el canal en este dispositivo. Tu membresía en el servidor se conserva.' });
      throw error;
    }
  }, [scope, server]);
  const ready = preference.scope === scope && preference.ready && directory.synced;
  // La preferencia nunca concede membresía. El ID validado permanece aunque cambie el nombre.
  const selectedChannel = ready ? directory.channels.find(channel => channel.id === preference.id) || directory.channels[0] || null : null;
  useEffect(() => {
    if (!ready) return;
    const fingerprint = JSON.stringify([scope, selectedChannel?.id, selectedChannel?.name]);
    if (written.current === fingerprint) return;
    written.current = fingerprint;
    if (preference.id !== (selectedChannel?.id || null)) setPreference({ scope, ready: true, id: selectedChannel?.id || null });
    void persist(selectedChannel).catch(() => {});
  }, [ready, scope, selectedChannel?.id, selectedChannel?.name, preference.id, persist]);
  const choose = useCallback((channel: Channel | null) => {
    if (active.current !== scope) return;
    ++revision.current;
    setPreference({ scope, ready: true, id: channel?.id || null });
    void persist(channel).catch(() => {});
  }, [scope, persist]);
  return { selectedChannel, choose,
    restoring: !!user && !ready && !directory.error,
    error: directory.error || (saveError?.scope === scope ? saveError.message : null),
    remember: () => persist(selectedChannel), forget: () => persist(null, true),
  };
}
