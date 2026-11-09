package expo.modules.walkietradio

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WalkietRadioModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WalkietRadioService")
    AsyncFunction("start") { channelName: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("La app no está disponible")
      if (appContext.currentActivity == null) throw IllegalStateException("Abre la app para conectar la radio")
      val intent = Intent(context, RadioForegroundService::class.java).putExtra("channel", channelName)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
      else context.startService(intent)
      Unit
    }
    AsyncFunction("stop") {
      appContext.reactContext?.let { it.stopService(Intent(it, RadioForegroundService::class.java)) }
    }
  }
}
