package expo.modules.walkietradio

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

class RadioForegroundService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(NotificationChannel("walkiet-radio-session", "Radio conectada", NotificationManager.IMPORTANCE_LOW))
    }
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val pending = if (launch != null) PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT) else null
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, "walkiet-radio-session") else Notification.Builder(this)
    val notification = builder.setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setContentTitle("Walkiet · Radio conectada")
      .setContentText(intent?.getStringExtra("channel") ?: "Escuchando el grupo seleccionado")
      .setContentIntent(pending).setOngoing(true).setCategory(Notification.CATEGORY_SERVICE).build()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      var types = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
      startForeground(7401, notification, types)
    } else startForeground(7401, notification)
    // La radio se activa por una acción visible del usuario. No se reinicia tras forzar cierre.
    return START_NOT_STICKY
  }
}
