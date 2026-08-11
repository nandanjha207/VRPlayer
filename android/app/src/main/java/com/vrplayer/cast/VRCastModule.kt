package com.vrplayer.cast

import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.fragment.app.FragmentActivity
import androidx.mediarouter.app.MediaRouteDialogFactory
import androidx.mediarouter.media.MediaRouter
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.cast.framework.CastContext
import com.google.android.gms.cast.framework.CastSession
import com.google.android.gms.cast.framework.SessionManagerListener

/**
 * Sample-app fallback for RNVideoGoogleCast when the prebuilt SDK AAR does not
 * expose @ReactMethod bridges (R8 strips com.brentvatne.googlecast.**).
 *
 * Logcat filter: tag:VRCast
 * JS listens for: VRCastSessionEvent
 */
class VRCastModule(
    reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = MODULE_NAME

  @ReactMethod
  fun addListener(eventName: String) {
    // Required for RN NativeEventEmitter compatibility.
  }

  @ReactMethod
  fun removeListeners(count: Double) {
    // Required for RN NativeEventEmitter compatibility.
  }

  @ReactMethod
  fun presentCastDialog() {
    Log.i(TAG, "presentCastDialog requested")
    UiThreadUtil.runOnUiThread {
      val activity = reactApplicationContext.currentActivity as? FragmentActivity
      if (activity == null) {
        Log.w(TAG, "presentCastDialog skipped: no FragmentActivity")
        return@runOnUiThread
      }

      try {
        ensureSessionObserver()
        val fragmentManager = activity.supportFragmentManager
        if (fragmentManager.findFragmentByTag(CHOOSER_TAG) != null ||
          fragmentManager.findFragmentByTag(CONTROLLER_TAG) != null
        ) {
          Log.i(TAG, "presentCastDialog skipped: dialog already visible")
          return@runOnUiThread
        }

        val castContext = CastContext.getSharedInstance(reactApplicationContext)
        val session = castContext.sessionManager.currentCastSession
        val factory = MediaRouteDialogFactory.getDefault()

        // Match SDK / iOS Cast UX:
        // - not casting → device picker
        // - already casting → controller (volume + Disconnect / Stop casting)
        if (session != null && session.isConnected) {
          logSessionState("before controller")
          factory.onCreateControllerDialogFragment()
            .show(fragmentManager, CONTROLLER_TAG)
          Log.i(TAG, "presentCastDialog: controller shown (volume + stop)")
          return@runOnUiThread
        }

        val selector = castContext.mergedSelector
        if (selector == null) {
          Log.w(TAG, "presentCastDialog skipped: mergedSelector is null")
          return@runOnUiThread
        }

        logRouteCount("before chooser")
        logSessionState("before chooser")
        val fragment = factory.onCreateChooserDialogFragment()
        fragment.setRouteSelector(selector)
        fragment.show(fragmentManager, CHOOSER_TAG)
        Log.i(TAG, "presentCastDialog: chooser shown")
      } catch (error: Exception) {
        Log.e(TAG, "presentCastDialog failed error=$error", error)
      }
    }
  }

  @ReactMethod
  fun stopCasting() {
    Log.i(TAG, "stopCasting requested")
    UiThreadUtil.runOnUiThread {
      try {
        CastContext.getSharedInstance(reactApplicationContext)
          .sessionManager
          .endCurrentSession(true)
        Log.i(TAG, "stopCasting: endCurrentSession called")
      } catch (error: Exception) {
        Log.e(TAG, "stopCasting failed error=$error", error)
      }
    }
  }

  /**
   * Stops media on the receiver without ending the Cast session.
   * Used when the user picks a non-castable source so the TV does not keep
   * playing the previous item.
   */
  @ReactMethod
  fun clearCastMedia() {
    Log.i(TAG, "clearCastMedia requested")
    UiThreadUtil.runOnUiThread {
      try {
        val session = CastContext.getSharedInstance(reactApplicationContext)
          .sessionManager
          .currentCastSession
        val client = session?.remoteMediaClient
        if (client == null) {
          Log.w(TAG, "clearCastMedia skipped: no remoteMediaClient")
          return@runOnUiThread
        }
        client.stop()
        Log.i(TAG, "clearCastMedia: remoteMediaClient.stop() called")
      } catch (error: Exception) {
        Log.e(TAG, "clearCastMedia failed error=$error", error)
      }
    }
  }

  @ReactMethod
  fun isCasting(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        val session = CastContext.getSharedInstance(reactApplicationContext)
          .sessionManager
          .currentCastSession
        val connected = session != null && session.isConnected
        val deviceName = session?.castDevice?.friendlyName
        val playerState = session?.remoteMediaClient?.mediaStatus?.playerState
        Log.i(
          TAG,
          "isCasting connected=$connected device=$deviceName playerState=$playerState",
        )
        promise.resolve(connected)
      } catch (error: Exception) {
        Log.w(TAG, "isCasting failed error=$error")
        promise.resolve(false)
      }
    }
  }

  private fun ensureSessionObserver() {
    if (sessionObserverAttached) {
      return
    }
    try {
      val castContext = CastContext.getSharedInstance(reactApplicationContext)
      castContext.sessionManager.addSessionManagerListener(
        sessionListener,
        CastSession::class.java,
      )
      sessionObserverAttached = true
      Log.i(TAG, "session observer attached")
    } catch (error: Exception) {
      Log.e(TAG, "session observer attach failed error=$error", error)
    }
  }

  private fun emitSessionEvent(
    event: String,
    session: CastSession?,
    sessionId: String? = null,
    errorCode: Int? = null,
  ) {
    val params: WritableMap = Arguments.createMap()
    params.putString("event", event)
    session?.castDevice?.friendlyName?.let { params.putString("deviceName", it) }
    sessionId?.let { params.putString("sessionId", it) }
    errorCode?.let { params.putInt("errorCode", it) }
    val playerState = session?.remoteMediaClient?.mediaStatus?.playerState
    if (playerState != null) {
      params.putInt("playerState", playerState)
    }

    try {
      reactApplicationContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(EVENT_NAME, params)
    } catch (error: Exception) {
      Log.w(TAG, "emitSessionEvent failed event=$event error=$error")
    }
  }

  private fun logRouteCount(phase: String) {
    try {
      val mediaRouter = MediaRouter.getInstance(reactApplicationContext.applicationContext)
      val count = mediaRouter.routes.count { route ->
        !route.isDefault && route.isEnabled
      }
      Log.i(TAG, "device availability ($phase) count=$count")
    } catch (error: Exception) {
      Log.w(TAG, "device availability ($phase) failed error=$error")
    }
  }

  private fun logSessionState(phase: String) {
    try {
      val session = CastContext.getSharedInstance(reactApplicationContext)
        .sessionManager
        .currentCastSession
      val connected = session?.isConnected == true
      val device = session?.castDevice?.friendlyName
      val playerState = session?.remoteMediaClient?.mediaStatus?.playerState
      Log.i(
        TAG,
        "session state ($phase) connected=$connected device=$device playerState=$playerState",
      )
    } catch (error: Exception) {
      Log.w(TAG, "session state ($phase) failed error=$error")
    }
  }

  private fun schedulePlayerStateLog(phase: String, delayMs: Long) {
    mainHandler.postDelayed({ logSessionState(phase) }, delayMs)
  }

  private val sessionListener = object : SessionManagerListener<CastSession> {
    override fun onSessionStarting(session: CastSession) {
      Log.i(TAG, "session STARTING device=${session.castDevice?.friendlyName}")
      emitSessionEvent("starting", session)
    }

    override fun onSessionStarted(session: CastSession, sessionId: String) {
      val device = session.castDevice?.friendlyName ?: session.castDevice?.deviceId
      val hasClient = session.remoteMediaClient != null
      Log.i(
        TAG,
        "session STARTED device=$device sessionId=$sessionId remoteMediaClient=$hasClient",
      )
      logSessionState("after session started")
      emitSessionEvent("started", session, sessionId)
      schedulePlayerStateLog("started+3s", 3000)
      schedulePlayerStateLog("started+10s", 10000)
    }

    override fun onSessionStartFailed(session: CastSession, error: Int) {
      Log.e(TAG, "session START FAILED errorCode=$error device=${session.castDevice?.friendlyName}")
      emitSessionEvent("start_failed", session, errorCode = error)
    }

    override fun onSessionEnding(session: CastSession) {
      Log.i(TAG, "session ENDING device=${session.castDevice?.friendlyName}")
      emitSessionEvent("ending", session)
    }

    override fun onSessionEnded(session: CastSession, error: Int) {
      Log.i(TAG, "session ENDED errorCode=$error device=${session.castDevice?.friendlyName}")
      emitSessionEvent("ended", session, errorCode = error)
    }

    override fun onSessionResuming(session: CastSession, sessionId: String) {
      Log.i(TAG, "session RESUMING sessionId=$sessionId")
      emitSessionEvent("resuming", session, sessionId)
    }

    override fun onSessionResumed(session: CastSession, wasSuspended: Boolean) {
      Log.i(
        TAG,
        "session RESUMED device=${session.castDevice?.friendlyName} wasSuspended=$wasSuspended",
      )
      emitSessionEvent("resumed", session)
    }

    override fun onSessionResumeFailed(session: CastSession, error: Int) {
      Log.e(TAG, "session RESUME FAILED errorCode=$error")
      emitSessionEvent("resume_failed", session, errorCode = error)
    }

    override fun onSessionSuspended(session: CastSession, reason: Int) {
      Log.w(TAG, "session SUSPENDED reason=$reason")
      emitSessionEvent("suspended", session, errorCode = reason)
    }
  }

  companion object {
    private const val TAG = "VRCast"
    private const val MODULE_NAME = "VRCast"
    private const val CHOOSER_TAG = "VRCastChooser"
    private const val CONTROLLER_TAG = "VRCastController"
    const val EVENT_NAME = "VRCastSessionEvent"
    private val mainHandler = Handler(Looper.getMainLooper())
    private var sessionObserverAttached = false
  }
}
