package com.zhiji.local;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class BookingCandidateParser {
    private static final Pattern RESULT = Pattern.compile("支付成功|付款成功|收款成功|转账成功|退款成功|交易成功|扣款成功|已支付|已收款|已到账|到账通知");
    private static final Pattern EXCLUDED = Pattern.compile("请输入|确认付款|支付密码|付款码|收款码|二维码|扫一扫|立即支付|继续付款|余额不足");
    private static final Pattern AMOUNT = Pattern.compile("(?:[¥￥]\\s*(\\d+(?:\\.\\d{1,2})?))|(?:(\\d+(?:\\.\\d{1,2})?)\\s*(?:元|CNY|RMB))", Pattern.CASE_INSENSITIVE);
    private static final Pattern INCOME = Pattern.compile("收款成功|已收款|已到账|到账通知|退款成功|退款到账");
    private static final Pattern REFUND = Pattern.compile("退款成功|退款到账");
    private static final Pattern MERCHANT = Pattern.compile("(?:商户|商家|收款方|付款方|对方|商品)\\s*[:：]?\\s*([^\\s，。,；;|]{2,24})");
    private static final Pattern ORDER = Pattern.compile("(?:订单号|交易单号|商户单号)\\s*[:：]?\\s*([A-Za-z0-9_-]{6,64})", Pattern.CASE_INSENSITIVE);
    private static final Pattern PHONE = Pattern.compile("(?<!\\d)1[3-9]\\d{9}(?!\\d)");
    private static final Pattern LONG_NUMBER = Pattern.compile("(?<!\\d)\\d{6,}(?!\\d)");

    private BookingCandidateParser() {}

    public static Candidate parse(String sourcePackage, String text, long createdAt, String channel) {
        if (!isAllowedPackage(sourcePackage) || text == null) return null;
        String normalized = text.replaceAll("\\s+", " ").trim();
        if (normalized.isEmpty() || normalized.length() > 4000) return null;
        if (EXCLUDED.matcher(normalized).find() || !RESULT.matcher(normalized).find()) return null;

        Matcher amountMatcher = AMOUNT.matcher(normalized);
        if (!amountMatcher.find()) return null;
        String amountValue = amountMatcher.group(1) != null ? amountMatcher.group(1) : amountMatcher.group(2);
        double amount;
        try {
            amount = Math.round(Double.parseDouble(amountValue) * 100d) / 100d;
        } catch (NumberFormatException exception) {
            return null;
        }
        if (!(amount > 0)) return null;

        String type = INCOME.matcher(normalized).find() ? "income" : "expense";
        String merchant = extract(MERCHANT, normalized);
        String orderToken = extract(ORDER, normalized);
        String sourceApp = "com.tencent.mm".equals(sourcePackage) ? "微信" : "支付宝";
        String sanitized = sanitize(normalized);
        String semantic = sourcePackage + "|" + type + "|" + String.format(Locale.US, "%.2f", amount) + "|" + merchant;
        String fingerprintSeed = orderToken.isEmpty()
            ? semantic + "|" + (createdAt / 120000L)
            : sourcePackage + "|" + type + "|" + amount + "|" + orderToken;
        String fingerprint = sha256(fingerprintSeed);
        int confidence = 80;
        if (!merchant.isEmpty()) confidence += 5;
        if (!orderToken.isEmpty()) confidence += 10;
        if (REFUND.matcher(normalized).find() || normalized.contains("支付成功") || normalized.contains("收款成功")) confidence += 5;

        return new Candidate(
            "candidate-" + fingerprint.substring(0, 24),
            fingerprint,
            sourcePackage,
            sourceApp,
            channel == null ? "accessibility" : channel,
            type,
            amount,
            merchant,
            sanitized,
            createdAt,
            Math.min(100, confidence)
        );
    }

    public static boolean isAllowedPackage(String sourcePackage) {
        return "com.tencent.mm".equals(sourcePackage) || "com.eg.android.AlipayGphone".equals(sourcePackage);
    }

    public static boolean isSameTransaction(Candidate first, Candidate second, long windowMillis) {
        if (first == null || second == null) return false;
        if (first.fingerprint.equals(second.fingerprint)) return true;
        return first.sourcePackage.equals(second.sourcePackage)
            && first.type.equals(second.type)
            && Math.abs(first.amount - second.amount) < 0.001d
            && first.merchant.equals(second.merchant)
            && Math.abs(first.createdAt - second.createdAt) <= windowMillis;
    }

    private static String extract(Pattern pattern, String text) {
        Matcher matcher = pattern.matcher(text);
        return matcher.find() ? matcher.group(1).trim() : "";
    }

    private static String sanitize(String text) {
        String sanitized = ORDER.matcher(text).replaceAll("订单号：****");
        sanitized = PHONE.matcher(sanitized).replaceAll("***");
        sanitized = LONG_NUMBER.matcher(sanitized).replaceAll("****");
        return sanitized.length() > 240 ? sanitized.substring(0, 240) : sanitized;
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder();
            for (byte item : bytes) result.append(String.format(Locale.US, "%02x", item));
            return result.toString();
        } catch (Exception exception) {
            throw new IllegalStateException("无法生成候选指纹", exception);
        }
    }

    public static final class Candidate {
        public final String id;
        public final String fingerprint;
        public final String sourcePackage;
        public final String sourceApp;
        public final String channel;
        public final String type;
        public final double amount;
        public final String merchant;
        public final String text;
        public final long createdAt;
        public final int confidence;

        Candidate(String id, String fingerprint, String sourcePackage, String sourceApp, String channel,
                  String type, double amount, String merchant, String text, long createdAt, int confidence) {
            this.id = id;
            this.fingerprint = fingerprint;
            this.sourcePackage = sourcePackage;
            this.sourceApp = sourceApp;
            this.channel = channel;
            this.type = type;
            this.amount = amount;
            this.merchant = merchant;
            this.text = text;
            this.createdAt = createdAt;
            this.confidence = confidence;
        }
    }
}
