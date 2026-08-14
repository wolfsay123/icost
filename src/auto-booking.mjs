import { registerPlugin } from "@capacitor/core";

const emptyStatus = { notificationAccess: false, accessibilityAccess: false, smsPermission: false };
const AutoBooking = registerPlugin("AutoBooking", {
  web: () => Promise.resolve({
    async getStatus() { return emptyStatus; },
    async openNotificationAccess() { throw new Error("请在 Android App 中开启通知自动记账"); },
    async openAccessibilityAccess() { throw new Error("请在 Android App 中开启无障碍自动记账"); },
    async drainNotifications() { return { items: [] }; },
    async readSms() { return { items: [] }; },
  }),
});

export const getAutoBookingStatus = () => AutoBooking.getStatus();
export const openNotificationAccess = () => AutoBooking.openNotificationAccess();
export const openAccessibilityAccess = () => AutoBooking.openAccessibilityAccess();
export const loadNotificationCandidates = () => AutoBooking.drainNotifications();
export const loadSmsCandidates = () => AutoBooking.readSms();
