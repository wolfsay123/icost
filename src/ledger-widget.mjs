import { registerPlugin } from "@capacitor/core";

const LedgerWidget = registerPlugin("LedgerWidget", {
  web: () => Promise.resolve({ async update() {} }),
});

export function updateLedgerWidget(summary) {
  return LedgerWidget.update(summary);
}
