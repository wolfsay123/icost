import { Capacitor, registerPlugin } from "@capacitor/core";

const memoryStore = { value: "" };
const SecureStore = registerPlugin("SecureStore", {
  web: () => Promise.resolve({
    async save(options) {
      memoryStore.value = String(options.value || "");
    },
    async load() {
      return { value: memoryStore.value };
    },
    async clear() {
      memoryStore.value = "";
    },
  }),
});

export async function saveSecureSyncConfig(config) {
  await SecureStore.save({ value: JSON.stringify(config) });
}

export async function loadSecureSyncConfig() {
  const result = await SecureStore.load();
  if (!result.value) return null;
  return JSON.parse(result.value);
}

export async function clearSecureSyncConfig() {
  await SecureStore.clear();
}

export function isNativeSecureStore() {
  return Capacitor.isNativePlatform();
}
