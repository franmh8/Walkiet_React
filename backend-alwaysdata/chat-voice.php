<?php
// Solo notas con audio real; no aceptar avisos de texto como si fueran grabaciones.
function chatValidVoice($media) {
    if (!is_string($media) || !preg_match('#^data:audio/(wav|mp4|m4a);base64,([A-Za-z0-9+/]+={0,2})$#D',$media,$match)) return false;
    $bytes=base64_decode($match[2],true);
    if ($bytes===false || strlen($bytes)<128 || strlen($bytes)>2000000) return false;
    if ($match[1]==='wav') return substr($bytes,0,4)==='RIFF' && substr($bytes,8,4)==='WAVE';
    return substr($bytes,4,4)==='ftyp';
}
