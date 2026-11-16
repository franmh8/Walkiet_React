<?php
// Plantilla compartida por SMTP y Gmail API. Sin imágenes remotas ni enlaces de seguimiento.
function securityMailTemplate($code,$purpose) {
    if (!is_string($code) || !preg_match('/^\d{6}$/D',$code)) throw new RuntimeException('mail_invalid_code');
    $change=$purpose==='email_change';
    $title=$change?'Verifica tu nuevo correo':'Recupera tu acceso';
    $intro=$change?'Estás a un paso de actualizar el correo de tu cuenta. Ingresa este código en Walkiet para confirmar tu nueva dirección.':'Vamos a ayudarte a volver a tu cuenta. Ingresa este código en Walkiet para elegir una contraseña nueva.';
    $text=$title." - Walkiet\n\n".$intro."\n\nTu código de verificación es: ".$code."\n\nCaduca en 3 minutos y solo puede usarse una vez. No lo compartas.\nSi no solicitaste este cambio, ignora este mensaje. Tu cuenta se conserva sin cambios.";
    $safeTitle=htmlspecialchars($title,ENT_QUOTES,'UTF-8');$safeIntro=htmlspecialchars($intro,ENT_QUOTES,'UTF-8');
    $html=<<<HTML
<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>$safeTitle · Walkiet</title></head>
<body style="margin:0;padding:0;background-color:#f4f1f2;font-family:Arial,Helvetica,sans-serif;color:#182132;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Tu código de Walkiet está listo. Es válido durante 3 minutos.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f1f2;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e6dce0;border-radius:24px;overflow:hidden;">
<tr><td style="padding:28px 32px;background-color:#691c32;border-radius:23px 23px 0 0;">
<div style="font-size:24px;font-weight:800;letter-spacing:4px;color:#ffffff;">WALKIET</div>
<div style="margin-top:8px;font-size:11px;font-weight:600;letter-spacing:2px;color:#edcbd5;">SIEMPRE EN CONTACTO</div>
</td></tr>
<tr><td style="padding:32px 28px 12px;">
<span style="display:inline-block;padding:8px 12px;border-radius:20px;background-color:#f8edf0;color:#691c32;font-size:10px;font-weight:700;letter-spacing:1.2px;">VERIFICACIÓN DE CUENTA</span>
<h1 style="margin:20px 0 14px;font-size:28px;line-height:1.2;letter-spacing:-0.7px;color:#182132;">$safeTitle</h1>
<p style="margin:0;font-size:15px;line-height:1.7;color:#607086;">$safeIntro</p>
</td></tr>
<tr><td align="center" style="padding:16px 28px 24px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fbf5f7;border:1px solid #ead4dc;border-radius:18px;"><tr><td align="center" style="padding:24px 8px;">
<div style="font-size:10px;letter-spacing:1.8px;font-weight:700;color:#8e5b6b;">TU CÓDIGO DE SEGURIDAD</div>
<div style="margin:14px 0;font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:700;letter-spacing:6px;line-height:1.2;color:#691c32;">$code</div>
<div style="font-size:12px;color:#75515d;">Válido por 3 minutos · Un solo uso</div>
</td></tr></table>
</td></tr>
<tr><td style="padding:0 28px 28px;">
<p style="margin:0;padding:16px;border-left:3px solid #b68193;border-radius:0 10px 10px 0;background-color:#f8fafc;font-size:13px;line-height:1.6;color:#526176;"><strong style="color:#334155;">Tu código es personal.</strong><br>No lo compartas. El equipo de Walkiet nunca te lo pedirá por llamada o mensaje.</p>
<p style="margin:20px 0 0;font-size:12px;line-height:1.7;color:#798698;">Si no solicitaste este cambio, puedes ignorar este correo. Tu cuenta se conserva sin cambios.</p>
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #eef0f3;background-color:#fafbfc;border-radius:0 0 23px 23px;font-size:11px;line-height:1.6;color:#8b96a5;">Enviado por Walkiet · Seguridad de tu cuenta<br>Este mensaje es automático; no necesitas responder.</td></tr>
</table>
<p style="margin:18px 0 0;font-size:10px;letter-spacing:1px;color:#9a8d92;">TU EQUIPO, SIEMPRE CERCA.</p>
</td></tr></table></body></html>
HTML;
    return ['subject'=>$title.' - Walkiet','text'=>$text,'html'=>$html];
}
