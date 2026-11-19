export interface ReplyPreview {id: string; authorId: string; authorName: string; text: string; mediaType: string; unavailable?: boolean;}
export interface SendContext {replyToId?: string; reply?: ReplyPreview; sourceMessageId?: string;}
export function mediaLabel(type?: string) {return ({image:'Foto',voice:'Nota de voz',document:'Documento',location:'Ubicación'} as Record<string,string>)[type || ''] || 'Mensaje';}
export function copyableText(message: {text: string; mediaType?: string; mediaUrl?: string; fileName?: string; deleted?: boolean}) {
  if(message.deleted)return '';
  if(message.mediaType==='location')return message.mediaUrl || message.text;
  if(message.mediaType==='document')return message.fileName || message.text;
  return !message.mediaType || message.mediaType==='text' ? message.text : '';
}
