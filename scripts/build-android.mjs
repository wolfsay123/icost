import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function javaVersion(javaHome) {
  if (!javaHome || !existsSync(join(javaHome, "bin", "java"))) return null;
  const result = spawnSync(join(javaHome, "bin", "java"), ["-version"], { encoding: "utf8" });
  const match = `${result.stdout}${result.stderr}`.match(/version "(\d+)/);
  return match ? Number(match[1]) : null;
}

function findJavaHome() {
  const candidates = [
    process.env.JAVA_HOME,
    "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home",
    "/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home",
  ];

  const macJava = spawnSync("/usr/libexec/java_home", ["-v", "21"], { encoding: "utf8" });
  if (macJava.status === 0) candidates.push(macJava.stdout.trim());

  const javaHome = candidates.find((candidate) => javaVersion(candidate) === 21);
  if (!javaHome) throw new Error("未找到 JDK 21，请先安装并设置 JAVA_HOME。");
  return javaHome;
}

function findAndroidSdk() {
  const candidates = [
    process.env.ANDROID_SDK_ROOT,
    process.env.ANDROID_HOME,
    join(homedir(), "Library", "Android", "sdk"),
  ];
  const sdk = candidates.find((candidate) => candidate && existsSync(join(candidate, "platforms", "android-36")));
  if (!sdk) throw new Error("未找到 Android SDK Platform 36，请先安装并设置 ANDROID_SDK_ROOT。");
  return sdk;
}

function run(command, args, cwd, env) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

try {
  const javaHome = findJavaHome();
  const androidSdk = findAndroidSdk();
  const env = {
    ...process.env,
    JAVA_HOME: javaHome,
    ANDROID_HOME: androidSdk,
    ANDROID_SDK_ROOT: androidSdk,
  };

  run("npm", ["run", "android:sync"], root, env);
  run(join(root, "android", "gradlew"), ["assembleDebug", "--no-daemon"], join(root, "android"), env);

  const releaseDir = join(root, "release");
  const releaseApk = join(releaseDir, "zhiji-android-debug.apk");
  mkdirSync(releaseDir, { recursive: true });
  copyFileSync(join(root, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"), releaseApk);
  console.log(`APK 已生成：${releaseApk}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
