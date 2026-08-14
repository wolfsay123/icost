import { registerPlugin } from "@capacitor/core";

const VoiceInput = registerPlugin("VoiceInput", {
  web: () => Promise.resolve({
    start() {
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Recognition) return Promise.reject(new Error("当前浏览器不支持语音识别"));
      return new Promise((resolve, reject) => {
        const recognition = new Recognition();
        recognition.lang = "zh-CN";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.onresult = (event) => resolve({ text: event.results[0][0].transcript });
        recognition.onerror = () => reject(new Error("语音识别失败"));
        recognition.onnomatch = () => reject(new Error("没有识别到语音内容"));
        recognition.start();
      });
    },
  }),
});

export async function captureVoiceInput() {
  const result = await VoiceInput.start();
  return String(result.text || "").trim();
}
