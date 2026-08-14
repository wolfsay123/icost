package com.zhiji.local;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(SecureStorePlugin.class);
        registerPlugin(VoiceInputPlugin.class);
        registerPlugin(AutoBookingPlugin.class);
        registerPlugin(LedgerWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
