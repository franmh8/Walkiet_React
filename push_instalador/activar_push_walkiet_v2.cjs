/* Integración segura y acotada de notificaciones push para Walkiet C5i.
 * Ejecutar desde la raíz del repositorio: node RUTA_DEL_SCRIPT/activar_push_walkiet_v2.cjs --dry-run
 * No toca package.json ni instala nada. No publica PHP ni ejecuta SQL.
 */
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const assets = path.join(__dirname, 'archivos');
const dry = process.argv.includes('--dry-run');
const plan=[];
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const lineEnd = txt => txt.includes('\r\n') ? '\r\n' : '\n';
function fail(msg){ throw new Error(msg); }
function onlyOne(txt,anchor,where){
  const count=txt.split(anchor).length-1;
  if(count!==1)fail(`${where}: se esperaba 1 coincidencia y se encontraron ${count}. No se modificó nada.`);
}
function change(file,converter){
  if(!fs.existsSync(path.join(root,file)))fail(`No encuentro ${file}. Abre Git Bash dentro de Walkiet_React.`);
  const old=read(file);
  const updated=converter(old);
  if(updated===old) fail(`${file}: no hubo cambios, tal vez ya estaba integrado.`);
  plan.push({file,old,updated});
}
try{
  if(!fs.existsSync(path.join(root,'package.json'))||!fs.existsSync(path.join(root,'src/native/NativeApp.tsx')))
    fail('Abre la terminal en la carpeta raíz Walkiet_React (donde está package.json).');
  if(!fs.existsSync(path.join(assets,'src/native/chat/useChatPushNotifications.ts')))
    fail('No encuentro la carpeta archivos. Extrae el ZIP completo, sin separar los archivos.');
  const ctr=read('src/native/chat/ChatController.tsx');
  if(!ctr.includes('unreadCount: Math.max(0, Number(t.unreadCount) || 0)'))
    fail('Tu código no contiene todavía la versión sincronizada del contador. Actualiza Git primero y vuelve a probar.');
  change('src/native/NativeApp.tsx',orig=>{
    const nl=lineEnd(orig);
    let s=orig;
    const importAnchor="import { useRadioNotifications } from './ptt/useRadioNotifications';";
    onlyOne(s,importAnchor,'NativeApp.tsx: import de notificaciones');
    s=s.replace(importAnchor,importAnchor+nl+"import { useChatPushNotifications } from './chat/useChatPushNotifications';");
    const code=[
      '  // Notificaciones de mensajes recibidas fuera de la app (APK/IPA propia).',
      '  const pendingPushThreadId = useRef<string | null>(null);',
      '  const openPushConversation = useCallback((threadId: string) => {',
      '    pendingPushThreadId.current = threadId;',
      "    setCurrentTab('Chat');",
      '  }, []);',
      '  const chatPush = useChatPushNotifications(',
      "    serverUrl, currentUser?.id || '', currentUser?.authToken || '', openPushConversation,",
      '  );',
      '  useEffect(() => {',
      '    const id = pendingPushThreadId.current;',
      '    if (!id) return;',
      '    const conversation = conversations.find(item => item.id === id);',
      '    if (!conversation) return;',
      '    pendingPushThreadId.current = null;',
      '    setActiveConversation(conversation);',
      '  }, [conversations, setActiveConversation]);',
      '',
    ].join(nl);
    const actionsAnchor='  const actions=useMessageActions(';
    onlyOne(s,actionsAnchor,'NativeApp.tsx: inicio de acciones de mensajes');
    const beforeActions=s.slice(0,s.indexOf(actionsAnchor));
    if(!beforeActions.includes('} = useChatController({'))fail('No encontré la inicialización de useChatController.');
    s=s.replace(actionsAnchor,code+actionsAnchor);
    const logoutAnchor='  const handleLogout = async (forgetAccount = false) => {';
    onlyOne(s,logoutAnchor,'NativeApp.tsx: cierre de sesión');
    s=s.replace(logoutAnchor, logoutAnchor+nl+'    await chatPush.unregister();');
    return s;
  });
  change('backend-alwaysdata/chat-sync.php',orig=>{
    const nl=lineEnd(orig);
    let s=orig;
    const include="require_once __DIR__.'/chat-voice.php';";
    onlyOne(s,include,'chat-sync.php: inclusión PHP');
    s=s.replace(include,include+nl+"require_once __DIR__.'/chat-push-dispatch.php';");
    const reply="chatRespond(201,array_merge(['success'=>true,'id'=>$id,'status'=>'sent','created_at'=>$saved['created_at']],chatTimeFields($saved['created_at'],$zone,$timestampColumn?$saved['sent_epoch']:null)));";
    onlyOne(s,reply,'chat-sync.php: respuesta de mensaje nuevo');
    s=s.replace(reply,"walkietRespondSavedWithPush($pdo,array_merge(['success'=>true,'id'=>$id,'status'=>'sent','created_at'=>$saved['created_at']],chatTimeFields($saved['created_at'],$zone,$timestampColumn?$saved['sent_epoch']:null)),(string)$thread,(string)$owner);");
    return s;
  });
  const copied=[
    'src/native/chat/useChatPushNotifications.ts',
    'backend-alwaysdata/chat-push-devices.php',
    'backend-alwaysdata/chat-push-dispatch.php',
    'sql/01_chat_push_devices.sql',
  ];
  for(const file of copied){
    const source=path.join(assets,file);
    if(!fs.existsSync(source))fail(`Falta ${file} dentro del ZIP`);
    const updated=fs.readFileSync(source,'utf8');
    const target=path.join(root,file);
    const old=fs.existsSync(target)?fs.readFileSync(target,'utf8'):null;
    if(old!==null && old!==updated)fail(`Ya existe ${file} con contenido diferente. No lo sobrescribiré.`);
    if(old===updated)continue;
    plan.push({file,old,updated});
  }
  console.log('VALIDADO: versión del contador, puntos de integración y archivos push.');
  plan.forEach(x=>console.log(`${x.old===null?'[NUEVO]':'[MODIFICA]'} ${x.file}`));
  if(dry){console.log('DRY-RUN: no se modificó ningún archivo.');process.exit(0);}
  const backup=path.resolve(root,'..','WalkietRespaldos',`push_v2_${new Date().toISOString().replace(/[:.]/g,'-')}`);
  fs.mkdirSync(backup,{recursive:true});
  for(const {file,old} of plan){if(old!==null){const dest=path.join(backup,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,old);}}
  for(const {file,updated} of plan){const dest=path.join(root,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,updated);}
  console.log(`APLICADO: ${plan.length} archivos, con respaldo en ${backup}`);
  console.log('Siguiente paso: npx tsc --noEmit. Aún falta configurar Firebase/EAS y publicar PHP + ejecutar SQL.');
}catch(error){console.error('NO APLICADO:',error.message);process.exit(1);}
