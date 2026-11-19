export async function copyMessageText(text: string) {
  try {if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}}catch{}
  const input=document.createElement('textarea');input.value=text;input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();
  try {if(!document.execCommand('copy'))throw new Error('No se pudo copiar el mensaje.');}finally{input.remove();}
}
