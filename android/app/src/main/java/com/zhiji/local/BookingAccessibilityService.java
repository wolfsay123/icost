package com.zhiji.local;

import android.accessibilityservice.AccessibilityService;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

public class BookingAccessibilityService extends AccessibilityService {
    private String lastFingerprint = "";
    private long lastCapturedAt = 0;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) return;
        String sourcePackage = event.getPackageName().toString();
        if (!BookingCandidateParser.isAllowedPackage(sourcePackage)) return;
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return;
        StringBuilder content = new StringBuilder();
        collectText(root, content, 0);
        long now = System.currentTimeMillis();
        BookingCandidateParser.Candidate candidate = BookingCandidateParser.parse(
            sourcePackage, content.toString(), now, "accessibility");
        if (candidate == null) return;
        if (candidate.fingerprint.equals(lastFingerprint) && now - lastCapturedAt < 5000L) return;
        lastFingerprint = candidate.fingerprint;
        lastCapturedAt = now;
        BookingNotificationService.enqueueCandidate(this, candidate);
    }

    private void collectText(AccessibilityNodeInfo node, StringBuilder content, int depth) {
        if (node == null || depth > 14 || content.length() > 1200) return;
        if (node.getText() != null) content.append(node.getText()).append(' ');
        if (node.getContentDescription() != null) content.append(node.getContentDescription()).append(' ');
        for (int index = 0; index < node.getChildCount(); index += 1) {
            collectText(node.getChild(index), content, depth + 1);
        }
    }

    @Override
    public void onInterrupt() {}
}
