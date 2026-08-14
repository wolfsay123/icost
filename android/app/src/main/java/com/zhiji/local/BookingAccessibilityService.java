package com.zhiji.local;

import android.accessibilityservice.AccessibilityService;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

public class BookingAccessibilityService extends AccessibilityService {
    private String lastText = "";
    private long lastCapturedAt = 0;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) return;
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return;
        StringBuilder content = new StringBuilder();
        collectText(root, content, 0);
        String text = content.toString().trim();
        long now = System.currentTimeMillis();
        if (!BookingNotificationService.isCandidate(text)) return;
        if (text.equals(lastText) && now - lastCapturedAt < 5000) return;
        lastText = text;
        lastCapturedAt = now;
        String source = event.getPackageName().toString();
        BookingNotificationService.enqueueCandidate(this, "accessibility-" + source + "-" + now, source, text, now);
    }

    private void collectText(AccessibilityNodeInfo node, StringBuilder content, int depth) {
        if (node == null || depth > 12 || content.length() > 600) return;
        if (node.getText() != null) content.append(node.getText()).append(' ');
        if (node.getContentDescription() != null) content.append(node.getContentDescription()).append(' ');
        for (int index = 0; index < node.getChildCount(); index += 1) {
            collectText(node.getChild(index), content, depth + 1);
        }
    }

    @Override
    public void onInterrupt() {}
}
