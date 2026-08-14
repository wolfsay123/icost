package com.zhiji.local;

import android.content.Context;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LedgerWidget")
public class LedgerWidgetPlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        getContext().getSharedPreferences(LedgerWidgetProvider.PREFERENCES, Context.MODE_PRIVATE)
            .edit()
            .putString("bookName", call.getString("bookName", "智记"))
            .putString("balance", call.getString("balance", "¥0.00"))
            .putString("income", call.getString("income", "收入 ¥0.00"))
            .putString("expense", call.getString("expense", "支出 ¥0.00"))
            .apply();
        LedgerWidgetProvider.updateAll(getContext());
        call.resolve();
    }
}
