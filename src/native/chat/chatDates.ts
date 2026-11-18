export interface ChatDateFields {
  sent_at_utc?: unknown; created_at_utc?: unknown; sent_at?: unknown; sentAt?: unknown;
  created_at?: unknown; createdAt?: unknown; timestamp?: unknown; date?: unknown;
  time_zone?: unknown; timezone?: unknown; server_timezone?: unknown;
}
function inZone(value: string, zone: string): number | null {
  const match=/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/.exec(value);
  if(!match)return null;
  const parts=match.slice(1,7).map(Number); const milliseconds=Number((match[7]||'').slice(0,3).padEnd(3,'0')); const [y,m,d,h,min,sec=0]=parts;
  const clock=Date.UTC(y,m-1,d,h,min,sec); const check=new Date(clock);
  if(check.getUTCFullYear()!==y||check.getUTCMonth()!==m-1||check.getUTCDate()!==d||h>23||min>59||sec>59)return null;
  try{
    const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
    let instant=clock;
    for(let i=0;i<3;i++){
      const p=Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part=>[part.type,part.value]));
      const represented=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
      if(represented===clock)return instant+milliseconds;
      instant+=clock-represented;
    }
  }catch{}
  return null;
}
export function chatInstant(fields: ChatDateFields, defaultZone?: string): string | null {
  const zone=[fields.time_zone,fields.timezone,fields.server_timezone,defaultZone].find(value=>typeof value==='string'&&value) as string|undefined;
  const candidates: [unknown, boolean][]=[[fields.sent_at_utc,true],[fields.created_at_utc,true],[fields.sent_at,false],[fields.sentAt,false],[fields.created_at,false],[fields.createdAt,false],[fields.timestamp,false]];
  if(typeof fields.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(fields.date)&&typeof fields.timestamp==='string')candidates.push([fields.date+' '+fields.timestamp,false]);
  for(const [raw,utc] of candidates){
    let ms:number|null=null;
    if(typeof raw==='number'&&Number.isFinite(raw)&&raw>0)ms=raw<1e12?raw*1000:raw;
    else if(typeof raw==='string'){
      const value=raw.trim();
      if(/^\d{10}(?:\d{3})?$/.test(value))ms=Number(value)*(value.length===10?1000:1);
      else if(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(value))ms=Date.parse(value.replace(' ','T'));
      else if(utc||zone)ms=inZone(value,utc?'UTC':zone!);
    }
    if(ms!==null&&Number.isFinite(ms)&&ms>0){try{return new Date(ms).toISOString();}catch{}}
  }
  return null;
}
export function chatTime(instant: string|null|undefined, legacy=''): string {
  if(instant&&Number.isFinite(Date.parse(instant)))return new Date(instant).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',hour12:false});
  return /^\d{1,2}:\d{2}(?:\s*[ap]\.?m\.?)?$/i.test(legacy)?legacy:'—';
}
export function chatDay(instant?: string|null): string {
  if(!instant||!Number.isFinite(Date.parse(instant)))return 'unknown';
  const d=new Date(instant);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function chatDayLabel(instant?: string|null, now=Date.now()): string {
  if(chatDay(instant)==='unknown')return 'Fecha no disponible';
  if(chatDay(instant)===chatDay(new Date(now).toISOString()))return 'Hoy';
  const yesterday=new Date(now);yesterday.setDate(yesterday.getDate()-1);
  if(chatDay(instant)===chatDay(yesterday.toISOString()))return 'Ayer';
  return new Date(instant!).toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'});
}
