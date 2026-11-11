// Ejecutar desde la raiz de Walkiet_React: node aplicar_correccion_documentos.cjs
// Solo modifica handlePickDocument y crea respaldo de NativeApp.tsx.
const fs = require('node:fs');
const path = require('node:path');

const project = process.cwd();
const target = path.join(project, 'src', 'native', 'NativeApp.tsx');
const START = 'const handlePickDocument = async () => {';
const NEXT = '  // Apertura nativa de documentos';

if (!fs.existsSync(target)) {
  console.error('ERROR: No encontre src/native/NativeApp.tsx. Abre una terminal en la carpeta Walkiet_React.');
  process.exit(1);
}
const oldText = fs.readFileSync(target, 'utf8');
const a = oldText.indexOf(START);
const b = a < 0 ? -1 : oldText.indexOf(NEXT, a + START.length);
if (a < 0 || b < 0 || oldText.indexOf(START, a + START.length) !== -1) {
  console.error('ERROR: No pude identificar una sola funcion handlePickDocument en el archivo. No cambie nada.');
  console.error('Si el codigo fue pegado dos veces, vuelve a la copia de seguridad y ejecuta de nuevo el parche.');
  process.exit(1);
}
const replacement = `const handlePickDocument = async () => {
    setIsAttachMenuOpen(false);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar';
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) return;
        if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
          window.alert('Elige un documento de hasta 3 MB.');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const sizeKb = (file.size / 1024).toFixed(1);
          sendMediaMessage('document', \`📄 \${file.name} (\${sizeKb} KB)\`, reader.result as string, file.name);
        };
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }
    try {
      const DocumentPicker = await import('expo-document-picker');
      const FileSystem = await import('expo-file-system/legacy');
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const fileName = asset.name || \`documento_\${Date.now()}\`;
      const cacheDirectory = FileSystem.cacheDirectory;
      if (!cacheDirectory) throw new Error('No se pudo acceder a la cache de la aplicacion.');

      let readableUri = asset.uri;
      if (!readableUri.startsWith(cacheDirectory)) {
        const safeName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const targetUri = \`\${cacheDirectory}walkiet_\${Date.now()}_\${safeName}\`;
        await FileSystem.copyAsync({ from: readableUri, to: targetUri });
        readableUri = targetUri;
      }
      const info = await FileSystem.getInfoAsync(readableUri);
      if (!info.exists) throw new Error('El documento no esta disponible. Vuelve a seleccionarlo.');
      const size = asset.size ?? info.size ?? 0;
      if (size > MAX_CHAT_ATTACHMENT_BYTES) {
        Alert.alert('Documento demasiado grande', 'Elige un documento de hasta 3 MB.');
        return;
      }
      const content = await FileSystem.readAsStringAsync(readableUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (Math.ceil(content.length * 0.75) > MAX_CHAT_ATTACHMENT_BYTES) {
        Alert.alert('Documento demasiado grande', 'Elige un documento de hasta 3 MB.');
        return;
      }
      const mime = asset.mimeType || extensionMime(fileName);
      const mediaUrl = \`data:\${mime};base64,\${content}\`;
      const actualBytes = Math.floor(content.length * 0.75);
      sendMediaMessage('document', \`📄 \${fileName} (\${(actualBytes / 1024).toFixed(1)} KB)\`, mediaUrl, fileName);
    } catch (error: any) {
      Alert.alert('No se pudo abrir Documentos', error?.message || 'Intenta elegir otro archivo.');
    }
  };

`;
const leading = oldText.slice(0, a);
const changed = leading + replacement + oldText.slice(b);
if (changed === oldText) {
  console.log('La correccion ya estaba aplicada; no se necesito cambiar el archivo.');
  process.exit(0);
}
// Comprobar la sintaxis TypeScript si esta disponible. Si hay errores se deja el archivo original intacto.
try {
  const ts = require(path.join(project, 'node_modules', 'typescript'));
  const parsed = ts.createSourceFile('NativeApp.tsx', changed, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (parsed.parseDiagnostics.length) {
    const first = parsed.parseDiagnostics[0];
    const line = parsed.getLineAndCharacterOfPosition(first.start || 0).line + 1;
    console.error('ERROR: El archivo aun tiene un problema de sintaxis en la linea ' + line + '. No hice cambios.');
    console.error(ts.flattenDiagnosticMessageText(first.messageText, '\n'));
    process.exit(1);
  }
} catch (err) {
  if (err && err.code === 'MODULE_NOT_FOUND') {
    console.log('Aviso: TypeScript no esta instalado. Se omite la revision de sintaxis.');
  } else {
    throw err;
  }
}
const backup = target + '.respaldo-' + new Date().toISOString().replace(/[:.]/g, '-');
fs.copyFileSync(target, backup);
fs.writeFileSync(target, changed, 'utf8');
console.log('CORRECTO: se actualizo src/native/NativeApp.tsx.');
console.log('Copia de seguridad: ' + path.basename(backup));
console.log('No se modificaron la ubicacion, las fotografias, la camara ni el resto del chat.');
