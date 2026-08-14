package com.zhiji.local;

import android.app.Notification;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

public class BookingNotificationService extends NotificationListenerService {
    static final String PREFERENCES = "zhiji_auto_booking";
    static final String QUEUE_KEY = "notification_candidates";
    private static final Pattern AMOUNT = Pattern.compile("(?:¥|￥)?\\s*\\d+(?:\\.\\d{1,2})?\\s*(?:元|块|CNY|RMB)");
    private static final Pattern TRANSACTION = Pattern.compile("支付|收款|消费|支出|收入|到账|扣款|转账|付款|退款");

    static boolean isCandidate(String text) {
        return text != null && AMOUNT.matcher(text).find() && TRANSACTION.matcher(text).find();
    }

    @Override
    public void onNotificationPosted(StatusBarNotification notification) {
        Bundle extras = notification.getNotification().extras;
        String title = String.valueOf(extras.getCharSequence(Notification.EXTRA_TITLE, ""));
        String text = String.valueOf(extras.getCharSequence(Notification.EXTRA_BIG_TEXT,
            extras.getCharSequence(Notification.EXTRA_TEXT, "")));
        String combined = (title + " " + text).trim();
        if (!isCandidate(combined)) return;

        enqueueCandidate(this, notification.getKey(), notification.getPackageName(), combined, notification.getPostTime());
    }

    static void enqueueCandidate(Context context, String id, String source, String text, long createdAt) {
        if (!isCandidate(text)) return;
        SharedPreferences preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
        synchronized (BookingNotificationService.class) {
            try {
                JSONArray existing = new JSONArray(preferences.getString(QUEUE_KEY, "[]"));
                JSONArray queue = new JSONArray();
                int start = Math.max(0, existing.length() - 48);
                for (int index = start; index < existing.length(); index += 1) queue.put(existing.get(index));
                JSONObject item = new JSONObject();
                item.put("id", id);
                item.put("source", source);
                item.put("text", text);
                item.put("createdAt", createdAt);
                queue.put(item);
                preferences.edit().putString(QUEUE_KEY, queue.toString()).apply();
            } catch (Exception ignored) {
                // 单条系统通知格式异常时不影响后续通知监听。
            }
        }
    }
}
