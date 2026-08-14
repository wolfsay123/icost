package com.zhiji.local;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONArray;

@CapacitorPlugin(
    name = "AutoBooking",
    permissions = { @Permission(alias = "sms", strings = { Manifest.permission.READ_SMS }) }
)
public class AutoBookingPlugin extends Plugin {
    @PluginMethod
    public void getStatus(PluginCall call) {
        String enabled = Settings.Secure.getString(getContext().getContentResolver(), "enabled_notification_listeners");
        ComponentName component = new ComponentName(getContext(), BookingNotificationService.class);
        String enabledAccessibility = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        ComponentName accessibilityComponent = new ComponentName(getContext(), BookingAccessibilityService.class);
        JSObject result = new JSObject();
        result.put("notificationAccess", enabled != null && enabled.contains(component.flattenToString()));
        result.put("accessibilityAccess", enabledAccessibility != null && enabledAccessibility.contains(accessibilityComponent.flattenToString()));
        result.put("smsPermission", getPermissionState("sms") == PermissionState.GRANTED);
        call.resolve(result);
    }

    @PluginMethod
    public void openNotificationAccess(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception exception) {
            call.reject("无法打开通知使用权设置", exception);
        }
    }

    @PluginMethod
    public void openAccessibilityAccess(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception exception) {
            call.reject("无法打开无障碍设置", exception);
        }
    }

    @PluginMethod
    public void drainNotifications(PluginCall call) {
        String content = getContext().getSharedPreferences(BookingNotificationService.PREFERENCES, Context.MODE_PRIVATE)
            .getString(BookingNotificationService.QUEUE_KEY, "[]");
        getContext().getSharedPreferences(BookingNotificationService.PREFERENCES, Context.MODE_PRIVATE)
            .edit().remove(BookingNotificationService.QUEUE_KEY).apply();
        try {
            JSObject result = new JSObject();
            result.put("items", new JSArray(new JSONArray(content).toString()));
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("通知候选读取失败", exception);
        }
    }

    @PluginMethod
    public void readSms(PluginCall call) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            requestPermissionForAlias("sms", call, "smsPermissionCallback");
            return;
        }
        querySms(call);
    }

    @PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            call.reject("短信读取权限未授权");
            return;
        }
        querySms(call);
    }

    private void querySms(PluginCall call) {
        JSArray items = new JSArray();
        Cursor cursor = null;
        try {
            cursor = getContext().getContentResolver().query(
                Uri.parse("content://sms/inbox"),
                new String[] { "_id", "address", "body", "date" },
                null,
                null,
                "date DESC"
            );
            int scanned = 0;
            while (cursor != null && cursor.moveToNext() && scanned < 100 && items.length() < 30) {
                scanned += 1;
                String body = cursor.getString(cursor.getColumnIndexOrThrow("body"));
                if (!BookingNotificationService.isCandidate(body)) continue;
                JSObject item = new JSObject();
                item.put("id", "sms-" + cursor.getString(cursor.getColumnIndexOrThrow("_id")));
                item.put("source", cursor.getString(cursor.getColumnIndexOrThrow("address")));
                item.put("text", body);
                item.put("createdAt", cursor.getLong(cursor.getColumnIndexOrThrow("date")));
                items.put(item);
            }
            JSObject result = new JSObject();
            result.put("items", items);
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("短信候选读取失败", exception);
        } finally {
            if (cursor != null) cursor.close();
        }
    }
}
