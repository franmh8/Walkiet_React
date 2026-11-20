#!/usr/bin/env node
/*
 * Walkiet - restaurar el contador sincronizado de chats sin restaurar el stash.
 * Sólo modifica 4 archivos TypeScript/TSX. No modifica Expo/Node/paquetes/PHP/SQL.
 * Ejecución: node scripts/activar_contador_walkiet_v5.cjs --dry-run
 *            node scripts/activar_contador_walkiet_v5.cjs
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root=process.cwd();
const dry=process.argv.includes('--dry-run');
const targets=[
  'src/native/NativeApp.tsx',
  'src/native/chat/ChatController.tsx',
  'src/native/chat/useChatAcknowledgements.ts',
  'src/services/chatSyncApi.ts',
];
const originals=new Map(),updated=new Map();
function replaceOnce(relative,oldText,newText,label){
  const s=updated.get(relative);
  const count=s.split(oldText).length-1;
  if(count!==1)throw Error(`No se pudo validar ${label} en ${relative}: esperado 1, encontrado ${count}. NO se modificó ningún archivo.`);
  updated.set(relative,s.replace(oldText,newText));
}
try{
  for(const relative of targets){
    const file=path.join(root,...relative.split('/'));
    if(!fs.existsSync(file))throw Error(`No encuentro ${relative}. Ejecuta desde la raíz Walkiet_React.`);
    const source=fs.readFileSync(file,'utf8');
    originals.set(relative,source);updated.set(relative,source.replace(/\r\n?/g,'\n'));
  }
  const app=targets[0],controller=targets[1],acks=targets[2],api=targets[3];
  replaceOnce(api,'  lastMessageStatus?: MessageStatus | null;',
    '  lastMessageStatus?: MessageStatus | null;\n  unreadCount?: number;', 'contador en tipo del servidor');
  replaceOnce(controller,
    'unreadCount: 0, hasMessages: t.hasMessages, lastMessageStatus:',
    'unreadCount: Math.max(0, Number(t.unreadCount) || 0), hasMessages: t.hasMessages, lastMessageStatus:',
    'contador de cada conversación');
  replaceOnce(api,
    'acknowledge(threadId: string, ids: string[], read=false): Promise<{read_recorded:boolean}> {',
    'acknowledge(threadId: string, ids: string[], read=false): Promise<{read_recorded:boolean;seen_recorded:boolean}> {',
    'respuesta de visto privado');
  replaceOnce(acks,'  const enabled=useRef(readReceipts);enabled.current=readReceipts;',
    '  // El visto privado se registra aunque las palomitas públicas estén desactivadas.',
    'privacidad de lectura');
  replaceOnce(acks,'if(!api||!threadId||!readReceipts)return;',
    'if(!api||!threadId)return;', 'lectura de conversación activa');
  replaceOnce(acks,'||!enabled.current||',
    '||', 'confirmación privada sin dependencia de privacidad');
  replaceOnce(acks,'if(response.read_recorded)ids.forEach(id=>confirmed.add(id));',
    'if(response.seen_recorded)ids.forEach(id=>confirmed.add(id));',
    'confirmación privada desde el servidor');
  replaceOnce(app,
    '  const chatScroll = useChatScroll(activeConversation?.id, activeConversation?.messages || []);',
    '  const totalUnreadCount = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);\n  const chatScroll = useChatScroll(activeConversation?.id, activeConversation?.messages || []);',
    'contador total');
  const icon=`            <MessageSquareIcon
              size={22}
              color={currentTab === 'Chat' ? palette.accent : palette.muted}
              strokeWidth={currentTab === 'Chat' ? 2.4 : 1.8}
            />`;
  const badge=`            <View style={{ position: 'relative' }}>
              <MessageSquareIcon
                size={22}
                color={currentTab === 'Chat' ? palette.accent : palette.muted}
                strokeWidth={currentTab === 'Chat' ? 2.4 : 1.8}
              />
              {totalUnreadCount > 0 && (
                <View style={{ position: 'absolute', right: -10, top: -8, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#E11D48', paddingHorizontal: 3, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{totalUnreadCount > 99 ? '99+' : totalUnreadCount}</Text>
                </View>
              )}
            </View>`;
  replaceOnce(app,icon,badge,'icono Chat del menú inferior');
  // La restauración no debe cambiar importaciones de Expo ni el flujo de adjuntos.
  for(const p of targets){
    const old=originals.get(p),newContent=updated.get(p);
    const oldExpo=(old.match(/expo-crypto/g)||[]).length;
    const newExpo=(newContent.match(/expo-crypto/g)||[]).length;
    if(oldExpo!==newExpo)throw Error(`Se alteraría una referencia a ExpoCrypto en ${p}: cancelado.`);
    if((old.match(/handlePickPhoto/g)||[]).length!==(newContent.match(/handlePickPhoto/g)||[]).length || (old.match(/handleOpenCamera/g)||[]).length!==(newContent.match(/handleOpenCamera/g)||[]).length)throw Error(`Se alteraría un botón de adjuntos en ${p}: cancelado.`);
    if(old.includes('\r\n'))updated.set(p,newContent.replace(/\n/g,'\r\n'));
  }
  console.log('VALIDADO: contador de Chat, marcas privadas de visto y tipos API encontrados.');
  console.log('Sólo se cambiarán estos 4 archivos:',targets.join(', '));
  console.log('NO se tocarán los PHP, MySQL, package.json, ExpoCrypto ni los botones de adjuntos.');
  if(dry){console.log('DRY-RUN: no se modificó ningún archivo.');process.exit(0);}
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const folder=path.resolve(root,'..','WalkietRespaldos','contador_frontend_v5_'+stamp);
  for(const p of targets){const dest=path.join(folder,...p.split('/'));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,originals.get(p));}
  for(const p of targets){fs.writeFileSync(path.join(root,...p.split('/')),updated.get(p));console.log('Actualizado:',p);}
  console.log('Respaldo:',folder);
  console.log('Ahora ejecuta: npx tsc --noEmit');
} catch(error){console.error('ERROR:',error.message);process.exitCode=1;}
