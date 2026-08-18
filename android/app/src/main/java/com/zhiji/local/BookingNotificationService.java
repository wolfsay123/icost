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
    static final String HISTORY_KEY = "handled_candidates";
    private static final long QUEUE_TTL = 7L * 24L * 60L * 60L * 1000L;
    private static final long HISTORY_TTL = 30L * 24L * 60L * 60L * 1000L;
    private static final Pattern AMOUNT = Pattern.compile("(?:¥|￥)?\\s*\\d+(?:\\.\\d{1,2})?\\s*(?:元|块|CNY|RMB)");
    private static final Pattern TRANSACTION = Pattern.compile("支付|收款|消费|支出|收入|到账|扣款|转账|付款|退款");

    static boolean isCandidate(String text) {
        return text != null && AMOUNT.matcher(text).find() && TRANSACTION.matcher(text).find();
    }

    @Override
    public void onNotificationPosted(StatusBarNotification notification) {
        if (notification == null || !BookingCandidateParser.isAllowedPackage(notification.getPackageName())) return;
        Bundle extras = notification.getNotification().extras;
        String title = String.valueOf(extras.getCharSequence(Notification.EXTRA_TITLE, ""));
        String text = String.valueOf(extras.getCharSequence(Notification.EXTRA_BIG_TEXT,
            extras.getCharSequence(Notification.EXTRA_TEXT, "")));
        BookingCandidateParser.Candidate candidate = BookingCandidateParser.parse(
            notification.getPackageName(), (title + " " + text).trim(), notification.getPostTime(), "notification");
        enqueueCandidate(this, candidate);
    }

    static synchronized void enqueueCandidate(Context context, BookingCandidateParser.Candidate candidate) {
        if (candidate == null) return;
        SharedPreferences preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
        try {
            long now = System.currentTimeMillis();
            JSONArray queue = prune(preferences.getString(QUEUE_KEY, "[]"), now - QUEUE_TTL, "createdAt", 100);
            JSONArray history = prune(preferences.getString(HISTORY_KEY, "[]"), now - HISTORY_TTL, "handledAt", 200);
            if (containsDuplicate(queue, candidate, 120000L) || containsDuplicate(history, candidate, 600000L)) return;
            queue.put(toJson(candidate));
            queue = tail(queue, 100);
            preferences.edit().putString(QUEUE_KEY, queue.toString()).putString(HISTORY_KEY, history.toString()).apply();
        } catch (Exception ignored) {
            // 单个系统事件格式异常时不影响后续监听。
        }
    }

    static synchronized JSONArray getCandidates(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
        JSONArray queue = prune(preferences.getString(QUEUE_KEY, "[]"), System.currentTimeMillis() - QUEUE_TTL, "createdAt", 100);
        preferences.edit().putString(QUEUE_KEY, queue.toString()).apply();
        return queue;
    }

    static synchronized int pendingCount(Context context) {
        return getCandidates(context).length();
    }

    static synchronized boolean acknowledgeCandidate(Context context, String id, String status) {
        if (id == null || id.isEmpty()) return false;
        SharedPreferences preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
        JSONArray queue = getCandidates(context);
        JSONArray remaining = new JSONArray();
        JSONObject handled = null;
        for (int index = 0; index < queue.length(); index += 1) {
            JSONObject item = queue.optJSONObject(index);
            if (item != null && id.equals(item.optString("id"))) handled = item;
            else if (item != null) remaining.put(item);
        }
        if (handled == null) return false;
        try {
            handled.put("handledAt", System.currentTimeMillis());
            handled.put("status", "confirmed".equals(status) ? "confirmed" : "dismissed");
            JSONArray history = prune(preferences.getString(HISTORY_KEY, "[]"), System.currentTimeMillis() - HISTORY_TTL, "handledAt", 200);
            history.put(handled);
            preferences.edit()
                .putString(QUEUE_KEY, remaining.toString())
                .putString(HISTORY_KEY, tail(history, 200).toString())
                .apply();
            return true;
        } catch (Exception exception) {
            return false;
        }
    }

    private static boolean containsDuplicate(JSONArray items, BookingCandidateParser.Candidate candidate, long windowMillis) {
        for (int index = 0; index < items.length(); index += 1) {
            BookingCandidateParser.Candidate existing = fromJson(items.optJSONObject(index));
            if (BookingCandidateParser.isSameTransaction(existing, candidate, windowMillis)) return true;
        }
        return false;
    }

    private static JSONObject toJson(BookingCandidateParser.Candidate item) throws Exception {
        JSONObject result = new JSONObject();
        result.put("id", item.id);
        result.put("fingerprint", item.fingerprint);
        result.put("sourcePackage", item.sourcePackage);
        result.put("sourceApp", item.sourceApp);
        result.put("source", item.sourceApp);
        result.put("channel", item.channel);
        result.put("type", item.type);
        result.put("amount", item.amount);
        result.put("merchant", item.merchant);
        result.put("text", item.text);
        result.put("createdAt", item.createdAt);
        result.put("confidence", item.confidence);
        return result;
    }

    private static BookingCandidateParser.Candidate fromJson(JSONObject item) {
        if (item == null || item.optString("fingerprint").isEmpty()) return null;
        return new BookingCandidateParser.Candidate(
            item.optString("id"), item.optString("fingerprint"), item.optString("sourcePackage"),
            item.optString("sourceApp"), item.optString("channel"), item.optString("type"),
            item.optDouble("amount"), item.optString("merchant"), item.optString("text"),
            item.optLong("createdAt"), item.optInt("confidence")
        );
    }

    private static JSONArray prune(String content, long minimumTimestamp, String timestampKey, int limit) {
        JSONArray result = new JSONArray();
        try {
            JSONArray source = new JSONArray(content == null ? "[]" : content);
            int start = Math.max(0, source.length() - limit);
            for (int index = start; index < source.length(); index += 1) {
                JSONObject item = source.optJSONObject(index);
                if (item != null && item.optLong(timestampKey, System.currentTimeMillis()) >= minimumTimestamp) result.put(item);
            }
        } catch (Exception ignored) {
            // 损坏的旧队列直接丢弃，避免阻断新的候选。
        }
        return result;
    }

    private static JSONArray tail(JSONArray source, int limit) {
        JSONArray result = new JSONArray();
        int start = Math.max(0, source.length() - limit);
        for (int index = start; index < source.length(); index += 1) result.put(source.opt(index));
        return result;
    }
}
