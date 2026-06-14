package com.globalradio.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

/**
 * Foreground service that keeps audio playback alive while the screen is off.
 *
 * Responsibilities:
 *   1. Promotes the app process to "foreground" so Android (and most OEM
 *      skins) won't kill it within seconds of the screen turning off.
 *   2. Holds a partial WakeLock + WifiLock so the CPU and Wi-Fi radio stay
 *      awake even in Doze mode.
 *   3. Shows a media-style notification so the system surface ("now playing")
 *      and lock screen controls work end-to-end.
 *
 * The service is started/stopped from JavaScript via BackgroundAudioPlugin.
 */
public class MediaPlaybackService extends Service {

    public static final String ACTION_START = "com.globalradio.app.action.START";
    public static final String ACTION_STOP = "com.globalradio.app.action.STOP";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_SUBTITLE = "subtitle";

    private static final int NOTIFICATION_ID = 0xA110;
    private static final String CHANNEL_ID = "global_radio_playback";
    private static final String WAKELOCK_TAG = "GlobalRadio:Playback";
    private static final String WIFILOCK_TAG = "GlobalRadio:WifiLock";

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            releaseLocks();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        // ACTION_START (default)
        String title = intent.getStringExtra(EXTRA_TITLE);
        String subtitle = intent.getStringExtra(EXTRA_SUBTITLE);

        Notification notification = buildNotification(title, subtitle);
        // Android 10+ requires a foregroundServiceType to identify the
        // service as media playback. On Android 14 (API 34) this is
        // strictly enforced: without the type the OS quietly downgrades
        // the service and kills it shortly after the screen turns off,
        // which is exactly the regression v2.0.6's SDK 34 bump caused.
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            // Fall back to the legacy call if the typed variant is rejected
            // (e.g. missing permission on a misconfigured ROM). Better to
            // have a partially-protected service than no service at all.
            startForeground(NOTIFICATION_ID, notification);
        }
        acquireLocks();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        releaseLocks();
        super.onDestroy();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // If the user swipes the app away, also stop playback. Keeping
        // playback alive after task removal is more confusing than useful
        // for a casual radio app.
        releaseLocks();
        stopForeground(true);
        stopSelf();
        super.onTaskRemoved(rootIntent);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Playback",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Keeps radio playback alive while the screen is off");
            channel.setShowBadge(false);
            channel.setSound(null, null);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification(String title, String subtitle) {
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int pendingFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
            ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            : PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent contentIntent = PendingIntent.getActivity(this, 0, launchIntent, pendingFlags);

        // @jofr/capacitor-media-session already publishes the user-facing
        // media notification (lock-screen controls, MediaStyle). Ours is
        // intentionally minimal — its only job is to hold foreground state
        // + wake locks. We use CATEGORY_SERVICE (not CATEGORY_TRANSPORT)
        // and VISIBILITY_PRIVATE so HyperOS/MIUI don't treat it as a
        // second active media controller and "helpfully" keep the screen
        // lit while playing.
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title != null && !title.isEmpty() ? title : getString(R.string.app_name))
            .setContentText(subtitle != null ? subtitle : "")
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .build();
    }

    private void acquireLocks() {
        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKELOCK_TAG);
                    wakeLock.setReferenceCounted(false);
                }
            }
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire();
            }

            if (wifiLock == null) {
                WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
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
            // Locks are best-effort. Failure here shouldn't crash playback.
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
