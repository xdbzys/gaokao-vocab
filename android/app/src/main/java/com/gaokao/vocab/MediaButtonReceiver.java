package com.gaokao.vocab;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.view.KeyEvent;

/**
 * v3.0.0：媒体按钮（耳机 / 蓝牙 / 车机 播放·暂停·上一曲·下一曲）广播接收器。
 *
 * 系统控制中心与各 ROM 的「正在播放」会把声明了 MEDIA_BUTTON 的组件视为
 * 可唤醒的媒体播放者。效果：息屏时按耳机播放键能拉起 PlayerService 续播，
 * 并在系统侧登记本 App 为最近媒体按钮接收者（与网易云/系统音乐软件一致）。
 */
public class MediaButtonReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        if (!Intent.ACTION_MEDIA_BUTTON.equals(intent.getAction())) return;
        KeyEvent key = intent.getParcelableExtra(Intent.EXTRA_KEY_EVENT);
        if (key == null || key.getAction() != KeyEvent.ACTION_DOWN) return;

        // 注意：Android 里 KEYCODE_MEDIA_PLAY(85) == KEYCODE_MEDIA_PLAY_PAUSE(85)、
        // KEYCODE_MEDIA_PAUSE(86) == KEYCODE_MEDIA_STOP(86)，不能用 switch（重复 case 编译失败），
        // 必须用 if / else。
        int code = key.getKeyCode();
        String action;
        if (code == KeyEvent.KEYCODE_MEDIA_NEXT) {
            action = "nexttrack";
        } else if (code == KeyEvent.KEYCODE_MEDIA_PREVIOUS) {
            action = "previoustrack";
        } else if (code == KeyEvent.KEYCODE_HEADSETHOOK
                || code == KeyEvent.KEYCODE_MEDIA_PLAY
                || code == KeyEvent.KEYCODE_MEDIA_PAUSE
                || code == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE
                || code == KeyEvent.KEYCODE_MEDIA_STOP) {
            // PLAY / PAUSE / PLAY_PAUSE / STOP / 线控 Hook 都当作播放/暂停切换，
            // 由 PlayerService 的 playpause 分支根据实际状态决定播放还是暂停。
            action = "playpause";
        } else {
            return;
        }
        try {
            Intent i = new Intent(context, PlayerService.class);
            i.setAction(PlayerService.ACTION_MEDIA);
            i.putExtra(PlayerService.EXTRA_MEDIA_ACTION, action);
            if (android.os.Build.VERSION.SDK_INT >= 26) {
                context.startForegroundService(i);
            } else {
                context.startService(i);
            }
        } catch (Throwable ignored) {}
    }
}
