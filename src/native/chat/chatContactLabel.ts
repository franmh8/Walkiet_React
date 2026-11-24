import type {ChatPeerInfo} from '../../services/chatSyncApi';

export function senderPhone(phone: string) {
  const digits=phone.replace(/\D/g,'');
  const national=digits.length===10?digits:digits.length===12&&digits.startsWith('52')?digits.slice(2):null;
  return national?`+52 ${national.slice(0,3)} ${national.slice(3,6)} ${national.slice(6)}`:digits?`+${digits}`:'';
}

export function chatContactLabel(conversation: {type: 'direct'|'group';name: string;peer?: ChatPeerInfo}) {
  return conversation.type==='direct'&&conversation.peer&&!conversation.peer.isContact
    ? senderPhone(conversation.peer.phoneNumber)||conversation.name : conversation.name;
}
