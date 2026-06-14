package com.globalradio.app;

import android.content.Context;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.PowerManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Background-audio helper plugin.
 *
 * History: v2.0.6 introduced a dedicated foreground service
 * ({@code MediaPlaybackService}) that posted its own (intentionally minimal)
 * notification on top of the one already published by
 * {@code @jofr/capacitor-media-session}. Two foreground services with
 * {@code foregroundServiceType="mediaPlayback"} ended up confusing the
 * system / OEM (especially MIUI/HyperOS), which would collapse them into a
 * single entry and pick the wrong (minimal) one — making the rich MediaStyle
 * "now playing" card disappear from the notification shade.
 *
 * v2.0.13 onwards: we no longer run our own service. The {@code @jofr}
 * plugin already owns the only foreground service with mediaPlayback type
 * (which is enough to keep playback alive after screen-off on API 34+).
 * Our remaining responsibility is to hold a {@code PARTIAL_WAKE_LOCK} +
 * {@code WifiLock} while audio is playing so Doze mode doesn't suspend
 * the radio stream. WakeLocks don't need a service — any component with a
 * {@link Context} can hold them — so we just acquire/release them directly
 * from the plugin's start/stop methods.
 *
 * JS contract is unchanged:
 *   - BackgroundAudio.start({ title, subtitle })  → acquire CPU + Wi-Fi locks
 *   - BackgroundAudio.stop()                       → release them
 */
@CapacitorPlugin(name = "BackgroundAudio")
public class BackgroundAudioPlugin extends Plugin {

    private static final String WAKELOCK_TAG = "GlobalRadio:Playback";
    private static final String WIFILOCK_TAG = "GlobalRadio:WifiLock";

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;

    @PluginMethod
    public void start(PluginCall call) {
        acquireLocks();
        JSObject result = new JSObject();
        result.put("started", true);
        call.resolve(result);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        releaseLocks();
        JSObject result = new JSObject();
        result.put("stopped", true);
        call.resolve(result);
    }

    @Override
    protected void handleOnDestroy() {
        releaseLocks();
        super.handleOnDestroy();
    }

    private void acquireLocks() {
        try {
            Context ctx = getContext();
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKELOCK_TAG);
                    wakeLock.setReferenceCounted(false);
                }
            }
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire();
            }

            if (wifiLock == null) {
                WifiManager wm = (WifiManager) ctx.getApplicationContext()
                    .getSystemService(Context.WIFI_SERVICE);
                if (wm != null) {
                    int mode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        ? WifiManager.WIFI_MODE_FULL_LOW_LATENCY
                        : WifiManager.WIFI_MODE_FULL_HIGH_PERF;
                    wifiLock = wm.createWifiLock(mode, WIFILOCK_TAG);
                    wifiLock.setReferenceCounted(false);
                }
            }
            if (wifiLock != null && !wifiLock.isHeld()) {
                wifiLock.acquire();
            }
        } catch (Exception ignored) {
            // Locks are best-effort; failure here shouldn't crash playback.
        }
    }

    private void releaseLocks() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
            if (wifiLock != null && wifiLock.isHeld()) {
                wifiLock.release();
            }
        } catch (Exception ignored) {
            // No-op
        }
    }
}
