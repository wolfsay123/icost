package com.zhiji.local;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

public class LedgerWidgetProvider extends AppWidgetProvider {
    static final String PREFERENCES = "zhiji_widget";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        for (int widgetId : widgetIds) updateWidget(context, manager, widgetId);
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] widgetIds = manager.getAppWidgetIds(new ComponentName(context, LedgerWidgetProvider.class));
        for (int widgetId : widgetIds) updateWidget(context, manager, widgetId);
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        SharedPreferences preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.ledger_widget);
        views.setTextViewText(R.id.widget_book_name, preferences.getString("bookName", "智记"));
        views.setTextViewText(R.id.widget_balance, preferences.getString("balance", "¥0.00"));
        views.setTextViewText(R.id.widget_income, preferences.getString("income", "收入 ¥0.00"));
        views.setTextViewText(R.id.widget_expense, preferences.getString("expense", "支出 ¥0.00"));

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("zhiji://record"), context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            1,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);
        manager.updateAppWidget(widgetId, views);
    }
}
