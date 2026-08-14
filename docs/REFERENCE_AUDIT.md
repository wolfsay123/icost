# 参考 APK 静态审计

审计日期：2026-08-11

## 样本

- 文件：`/Users/a0000/Downloads/com.cxincx.xxjz_4.0.8.apk`
- 包名：`com.cxincx.xxjz`
- 版本：`4.0.8`
- SHA-256：`c18d86841d455c699c168b85ae8e6e0f2cf31db317ba3e827ddbefaa43d16f32`
- 最低 Android：API 23；目标 Android：API 36。

## 已确认的功能域

Manifest 与资源字符串确认了多账本、收支/转账/借贷/应收应付、退款与报销、账户与信用卡、预算与目标、统计报表、周期账与分期、家庭/成员、分类/标签/商家、多币种、照片/位置/模板、导入导出、回收站、应用锁、短信/自动记账、桌面组件、语音，以及 WebDAV/坚果云/阿里云备份入口。

本项目已覆盖上述本地记账主链和坚果云 WebDAV 主链。微信授权登录、原厂云服务、阿里云盘、原品牌资源和原签名不在本地版范围内。

## 技术边界

- 应用使用 `com.sagittarius.v6.StubApplication` 和 `libbaiduprotect.so`，业务代码受百度加固保护；JADX 静态结果主要是资源类，无法把原业务源码作为实现依据。
- 当前实现是依据可验证的 Manifest/资源功能面和独立业务规则重新开发，不是复制原 APK 源码。
- 动态页面路径仍需 ARM 模拟器或安卓真机。安装 Android 36 ARM 系统镜像时出现新的 `android-sdk-arm-dbt-license`，尚未在缺少专项同意时接受。
