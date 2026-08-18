package com.zhiji.local;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class BookingCandidateParserTest {
    @Test
    public void parsesWechatPaymentResult() {
        BookingCandidateParser.Candidate item = BookingCandidateParser.parse(
            "com.tencent.mm",
            "支付成功 ￥38.50 商户：星巴克 订单号：WX202608180001",
            100000L,
            "accessibility"
        );

        assertEquals("expense", item.type);
        assertEquals(38.50d, item.amount, 0.001d);
        assertEquals("星巴克", item.merchant);
        assertEquals("微信", item.sourceApp);
        assertFalse(item.text.contains("WX202608180001"));
        assertTrue(item.confidence >= 95);
    }

    @Test
    public void parsesIncomeAndRefundAsIncome() {
        BookingCandidateParser.Candidate receipt = BookingCandidateParser.parse(
            "com.eg.android.AlipayGphone", "收款成功 88.00元 付款方：测试用户", 200000L, "accessibility");
        BookingCandidateParser.Candidate refund = BookingCandidateParser.parse(
            "com.tencent.mm", "退款成功 ¥12.30 商户：便利店", 300000L, "notification");

        assertEquals("income", receipt.type);
        assertEquals("支付宝", receipt.sourceApp);
        assertEquals("income", refund.type);
    }

    @Test
    public void rejectsOperationPagesAndUnrelatedPackages() {
        assertNull(BookingCandidateParser.parse(
            "com.tencent.mm", "请输入支付密码 确认付款 38.50元", 100000L, "accessibility"));
        assertNull(BookingCandidateParser.parse(
            "com.example.other", "支付成功 38.50元", 100000L, "accessibility"));
        assertNull(BookingCandidateParser.parse(
            "com.tencent.mm", "今日余额 38.50元", 100000L, "accessibility"));
    }

    @Test
    public void masksPhoneAndLongNumbers() {
        BookingCandidateParser.Candidate item = BookingCandidateParser.parse(
            "com.tencent.mm", "支付成功 20元 商户：便利店 联系人13812345678 流水123456789", 100000L, "accessibility");

        assertFalse(item.text.contains("13812345678"));
        assertFalse(item.text.contains("123456789"));
    }

    @Test
    public void mergesAccessibilityAndNotificationForSameTransaction() {
        BookingCandidateParser.Candidate accessibility = BookingCandidateParser.parse(
            "com.tencent.mm", "支付成功 20元 商户：便利店", 120000L, "accessibility");
        BookingCandidateParser.Candidate notification = BookingCandidateParser.parse(
            "com.tencent.mm", "支付成功 20元 商户：便利店", 180000L, "notification");
        BookingCandidateParser.Candidate anotherMerchant = BookingCandidateParser.parse(
            "com.tencent.mm", "支付成功 20元 商户：咖啡店", 180000L, "notification");

        assertTrue(BookingCandidateParser.isSameTransaction(accessibility, notification, 120000L));
        assertFalse(BookingCandidateParser.isSameTransaction(accessibility, anotherMerchant, 120000L));
    }
}
