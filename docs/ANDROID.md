# Android 安装与验收

## 安装包

- 文件：`release/zhiji-android-debug.apk`
- 应用名：智记
- 包名：`com.zhiji.local`
- 版本：`0.7.0`（versionCode 6）
- 最低系统：Android 7.0（API 24）
- 文件大小：11,677,815 bytes
- SHA-256：`fc2f6832481d69807f8bc9198bdd8f1f39def7c496f974eb9030f300e0874419`

这是供个人试用的 Debug APK，使用 Android SDK 调试证书签名，不用于应用商店发布。升级时需继续使用同一签名；若手机上存在不同签名的同包名版本，应先备份数据再卸载旧版。

## 手机安装

1. 将 APK 发送到安卓手机并打开。
2. 系统提示时，只为当前文件来源开启“允许安装未知应用”。
3. 完成安装后打开“智记”，新增一笔账，退出并重新打开确认数据仍存在。
4. 在系统桌面添加“智记”小组件，点按后应直接进入记账页。

手机通过 USB 连接并授权调试后，也可执行：

```bash
adb install -r release/zhiji-android-debug.apk
```

## 权限说明

- 网络：连接坚果云 HTTPS WebDAV；应用明确禁止明文 HTTP。
- 麦克风：仅在点按“语音输入”后调用系统语音识别。
- 短信：仅在点按“读取短信候选”后读取最近短信并筛选交易关键词；不自动入账。
- 通知使用权：仅处理微信和支付宝通知中的支付结果，生成与无障碍通道共享去重规则的待确认候选。
- 无障碍：仅配置并校验微信和支付宝包名；只从支付成功、收款成功、转账成功或退款成功结果页提取收支类型、金额、商家和脱敏摘要，付款操作页不会生成候选。
- 自动候选：写入本地持久队列，App 启动或返回前台时弹出；确认后才入账，取消会保留待办，忽略会移除，不点击支付、不自动提交账目。
- 定位：仅在点按“记录当前位置”后附加经纬度。

所有高权限均可不授权，基础手动记账和坚果云同步仍可使用。

## 坚果云验收

1. 在坚果云“账户信息 > 安全选项 > 第三方应用管理”生成应用密码。
2. 在“设置与同步”填写默认地址、登录邮箱、应用密码、独立云端路径和至少 8 位同步密钥。
3. 先点“测试连接”，再点“上传备份”；确认坚果云出现加密文件。
4. 新增一笔测试账目，再点“从云端恢复”，确认回到上传时状态。
5. 开启自动同步，新增账目后等待上传；再从另一设备制造较新修订，确认覆盖前出现冲突提示。

恢复会覆盖当前设备数据。首次验收建议使用独立路径，如 `智记/测试/zhiji-backup.enc.json`。开启自动同步时，账号、应用密码和同步密钥由 Android Keystore 加密保存；关闭时只留在当前页面内存。

## 本机构建

需要 Node.js 22、JDK 21、Android SDK Platform 36 和 Build Tools 36.0.0：

```bash
npm install
npm run android:apk
```

Gradle 原始 APK 位于 `android/app/build/outputs/apk/debug/app-debug.apk`，交付副本位于 `release/zhiji-android-debug.apk`。

## 模拟器验收状态

- `android-sdk-arm-dbt-license` 与常规 Android SDK 许可已接受。
- 目标 APK 最低 API 23，智记最低 API 24，因此选用 Android 7.0（API 24）AOSP ARM64 镜像可同时安装两个 APK，不改变智记的 targetSdk 36。
- Android Emulator 37.1.11 官方包：394,555,844 bytes，SHA-1 `f22f44948a2b7f0a0103645b9a639290eef92426`。
- API 24 AOSP ARM64 官方镜像：305,854,153 bytes，SHA-1 `e88ebdf4533efa0370603ee4ab0e7834e0cc364f`。
- 2026-08-18 下载多次被 Google 官方 CDN 限速至约 0.05-0.2 MB/s，组件尚未完整安装；本次没有模拟器安装/启动证据，不能把 APK 构建与浏览器测试表述为 Android 动态验收。
- 当前 `adb devices` 未发现已授权设备，因此 0.7.0 尚未直接安装到用户手机，微信/支付宝真实结果页识别仍待真机验证。

网络恢复后可继续使用 SDK 管理器安装：

```bash
sdkmanager "emulator" "system-images;android-24;default;arm64-v8a"
```

安装完成后创建隔离 AVD，再分别安装目标 APK 与 `release/zhiji-android-debug.apk`。目标样本只用于观察页面、输入输出和持久化结果，不提取品牌素材、签名或加固代码。
