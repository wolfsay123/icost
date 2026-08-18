import { registerPlugin } from "@capacitor/core";

const WEB_QUEUE_KEY = "zhiji.auto-booking.web.v1";

function readWebQueue() {
  try {
    const value = JSON.parse(localStorage.getItem(WEB_QUEUE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

const emptyStatus = { notificationAccess: false, accessibilityAccess: false, smsPermission: false, pendingCount: 0 };
const AutoBooking = registerPlugin("AutoBooking", {
  web: () => Promise.resolve({
    async getStatus() { return { ...emptyStatus, pendingCount: readWebQueue().length }; },
    async openNotificationAccess() { throw new Error("请在 Android App 中开启通知自动记账"); },
    async openAccessibilityAccess() { throw new Error("请在 Android App 中开启无障碍自动记账"); },
    async drainNotifications() { return { items: readWebQueue() }; },
    async acknowledgeCandidate({ id }) {
      const next = readWebQueue().filter((item) => item.id !== id);
      localStorage.setItem(WEB_QUEUE_KEY, JSON.stringify(next));
      return { removed: true };
    },
    async readSms() { return { items: [] }; },
  }),
});

export const getAutoBookingStatus = () => AutoBooking.getStatus();
export const openNotificationAccess = () => AutoBooking.openNotificationAccess();
export const openAccessibilityAccess = () => AutoBooking.openAccessibilityAccess();
export const loadNotificationCandidates = () => AutoBooking.drainNotifications();
export const acknowledgeAutoBookingCandidate = (id, status) => AutoBooking.acknowledgeCandidate({ id, status });
export const loadSmsCandidates = () => AutoBooking.readSms();
