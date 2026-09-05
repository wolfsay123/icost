# 开源记账逻辑参考审计

更新日期：2026-09-05

## 目的

为智记建立可追溯的开源记账逻辑基线。参考项目只用于核对数据模型、业务不变量、异常路径和测试方法；除非许可证兼容且明确记录来源，不把第三方源码、品牌素材或资源文件复制进智记。

## 审计结论

- 未发现“小星记账”官方公开 GitHub 源码。当前可确认材料是官网、帮助中心及第三方适配代码，不能据此宣称获得了原应用源码。
- 智记不应整体替换成某个参考项目。现有 v5 已覆盖九类交易、退款、信用账单、应收应付、严格报销、存钱计划、自动候选和坚果云加密备份，整仓替换会造成能力倒退和数据迁移风险。
- `MyExpenses` 最适合作为成熟业务规则与测试组织参考；`MoneyBook` 的最小货币单位和恢复校验可借鉴；`Cashew` 适合研究预算范围和交互；`AutoAccounting` 适合研究多渠道候选管线与字段合并。
- 只有 `MoneyBook` 是 MIT。其余三个仓库根许可证均为 GPL-3.0，默认只做行为和架构参考，不直接复制实现到智记。

## 固定版本

本次使用 `git clone --depth 1` 拉取到 `/private/tmp/icost-open-source-audit-20260905/`，临时目录不进入智记仓库。

| 项目 | 固定提交 | 提交时间 | 根许可证 | 审计定位 |
| --- | --- | --- | --- | --- |
| [MoneyBook](https://github.com/AndersOnLin4/moneybook) | `98c50341da262e839f68557e721eee38aca57067` | 2026-08-15 | MIT | 小型 Android 原生实现；金额、周期账和完整恢复 |
| [MyExpenses](https://github.com/mtotschnig/MyExpenses) | `51f25c813e7f1ee9819c431f186c6b0f0478cedf` | 2026-09-04 | GPL-3.0 | 成熟账务模型、转账/拆分、对账、同步与测试 |
| [Cashew](https://github.com/jameskokoska/Cashew) | `9cfbe50c16d95429891d44faf5f2c77a3abdb93b` | 2026-03-08 | GPL-3.0 | 自定义预算周期、预算过滤、目标与借贷交互 |
| [AutoAccounting](https://github.com/AutoAccountingOrg/AutoAccounting) | `601794a2f29b826672ee81a595ca86bc5a95ffcd` | 2026-09-04 | GPL-3.0 | 通知/短信/OCR、规则解析、候选去重及第三方记账适配 |

许可证判断以仓库根许可证为准。`AutoAccounting` 若干文件头写有不存在的“Apache License 3.0”，不能据此覆盖根目录 GPL-3.0 结论。

## 关键源码入口

以下链接均锁定到本次审计提交，不随主分支更新而变化：

| 领域 | 源码与测试 |
| --- | --- |
| MoneyBook 金额实体 | [`Bill.kt`](https://github.com/AndersOnLin4/moneybook/blob/98c50341da262e839f68557e721eee38aca57067/app/src/main/java/com/andersonlin/moneybook/data/model/Bill.kt) |
| MoneyBook 周期账 | [`RecurringRepository.kt`](https://github.com/AndersOnLin4/moneybook/blob/98c50341da262e839f68557e721eee38aca57067/app/src/main/java/com/andersonlin/moneybook/data/repository/RecurringRepository.kt) |
| MoneyBook 加密备份 | [`BackupManager.kt`](https://github.com/AndersOnLin4/moneybook/blob/98c50341da262e839f68557e721eee38aca57067/app/src/main/java/com/andersonlin/moneybook/data/backup/BackupManager.kt) |
| MoneyBook 存钱目标 | [`SavingDepositService.kt`](https://github.com/AndersOnLin4/moneybook/blob/98c50341da262e839f68557e721eee38aca57067/app/src/main/java/com/andersonlin/moneybook/data/saving/SavingDepositService.kt) |
| MyExpenses 金额对象 | [`Money.kt`](https://github.com/mtotschnig/MyExpenses/blob/51f25c813e7f1ee9819c431f186c6b0f0478cedf/myExpenses/src/main/java/org/totschnig/myexpenses/model/Money.kt) |
| MyExpenses 交易关系 | [`Transaction.kt`](https://github.com/mtotschnig/MyExpenses/blob/51f25c813e7f1ee9819c431f186c6b0f0478cedf/myExpenses/src/main/java/org/totschnig/myexpenses/db2/entities/Transaction.kt) |
| MyExpenses 转账/拆分测试 | [`TransactionTest.kt`](https://github.com/mtotschnig/MyExpenses/blob/51f25c813e7f1ee9819c431f186c6b0f0478cedf/myExpenses/src/test/java/org/totschnig/myexpenses/repository/TransactionTest.kt) |
| MyExpenses WebDAV | [`WebDavBackendProvider.kt`](https://github.com/mtotschnig/MyExpenses/blob/51f25c813e7f1ee9819c431f186c6b0f0478cedf/webdav/src/main/java/org/totschnig/webdav/sync/WebDavBackendProvider.kt) |
| Cashew 数据与预算模型 | [`tables.dart`](https://github.com/jameskokoska/Cashew/blob/9cfbe50c16d95429891d44faf5f2c77a3abdb93b/budget/lib/database/tables.dart) |
| Cashew 周期交易 | [`upcomingTransactionsFunctions.dart`](https://github.com/jameskokoska/Cashew/blob/9cfbe50c16d95429891d44faf5f2c77a3abdb93b/budget/lib/struct/upcomingTransactionsFunctions.dart) |
| AutoAccounting 小星公开接口适配 | [`XiaoXinAdapter.kt`](https://github.com/AutoAccountingOrg/AutoAccounting/blob/601794a2f29b826672ee81a595ca86bc5a95ffcd/app/src/main/java/net/ankio/auto/adapter/XiaoXinAdapter.kt) |
| AutoAccounting 多渠道去重 | [`DuplicateDetector.kt`](https://github.com/AutoAccountingOrg/AutoAccounting/blob/601794a2f29b826672ee81a595ca86bc5a95ffcd/server/src/main/java/org/ezbook/server/tools/DuplicateDetector.kt) |
| AutoAccounting 字段合并 | [`BillMerger.kt`](https://github.com/AutoAccountingOrg/AutoAccounting/blob/601794a2f29b826672ee81a595ca86bc5a95ffcd/server/src/main/java/org/ezbook/server/tools/BillMerger.kt) |
| AutoAccounting 通知采集 | [`NotificationService.kt`](https://github.com/AutoAccountingOrg/AutoAccounting/blob/601794a2f29b826672ee81a595ca86bc5a95ffcd/app/src/main/java/net/ankio/auto/service/NotificationService.kt) |
| AutoAccounting WebDAV | [`WebDAVManager.kt`](https://github.com/AutoAccountingOrg/AutoAccounting/blob/601794a2f29b826672ee81a595ca86bc5a95ffcd/app/src/main/java/net/ankio/auto/storage/backup/WebDAVManager.kt) |

## 可信度分级

| 项目 | 成熟度证据 | 测试证据 | 使用结论 |
| --- | --- | --- | --- |
| MyExpenses | 大型持续维护仓库，账务、同步、导入和 UI 分模块 | 存在大量单元、Robolectric 与 Android 仪器测试，覆盖转账、拆分、金额、账户、同步和导入 | **高**：优先参考业务不变量和测试矩阵，但不复制 GPL 代码 |
| AutoAccounting | 识别渠道和适配器分层清晰，包含真实多来源场景 | 有合并、转账、分类及并发账单测试；部分测试仍是场景驱动脚本 | **中高**：参考管线、证据保留和字段合并，去重规则需收紧 |
| Cashew | 功能面广、数据库迁移历史长 | 主工程仅发现一个默认 Flutter widget 测试，无法证明核心财务口径 | **中**：参考产品范围和筛选表达，不采用其金额表示与测试结论 |
| MoneyBook | 代码量小、结构直观、许可证宽松 | 当前固定提交未发现测试源文件，README 中的迁移断言无法从仓库独立复核 | **中低**：可借鉴简单实现，必须由智记自己的测试重新证明 |

## 可吸收逻辑

### 1. 金额与币种

`MyExpenses` 的 `Money` 使用货币最小单位 `Long`，同币种才能直接加减，并用精确溢出检查；`MoneyBook` 的账单也使用 `amountCents: Long`。这比智记当前“浮点数加两位舍入”更稳健。

采用建议：

- v6 将持久化金额改为整数最小单位，并随币种保存 `fractionDigits`。
- 导入旧 v5 时只做一次明确舍入，迁移后所有余额、退款上限、分期尾差和预算统计只使用整数。
- 汇率可保留高精度十进制字符串；折算结果在业务边界按目标币种精度舍入。

不采用：`Cashew` 的交易和预算金额使用 SQLite `REAL`/Dart `double`，不能作为智记金额内核基线；`AutoAccounting` 候选金额也是 `Double`，只能停留在识别 DTO，确认入账前必须转成最小单位。

### 2. 交易、转账与拆分

`MyExpenses` 用互相引用的两条交易表达转账，并保存原币金额、折算金额、清算状态、拆分父项和 UUID；其测试验证双向引用、两端金额符号、联动删除和拆分金额。

采用建议：

- 保留智记当前“一条转账记录 + 来源/目标账户”的规范模型，避免把 v5 全量改成双分录。
- 在领域层统一投影账户影响：来源账户负向、目标账户正向；跨币种分别保存来源最小单位、目标最小单位和锁定汇率。
- 增加转账不变量测试：来源与目标不同、两账户均可用于账本、净资产守恒、编辑/删除/恢复同时影响两端。
- 拆分交易增加父记录与子项稳定 ID，并强制“子项合计 = 父金额”。

不采用：直接复制 MyExpenses 的 ContentProvider、双记录数据库结构或 GPL 实现。

### 3. 预算与目标

`Cashew` 的预算可表达自定义起止日期、周期长度、账户范围、分类包含/排除、是否包含收入、借贷、余额调整及成员过滤。这种“预算范围对象”比只保存分类和金额更适合智记后续扩展。

采用建议：

- 预算统一保存 `period`、`scope`、`rollover` 和 `amountMinor`。
- `scope` 明确账户、分类、成员、商家、标签、交易类型及“不计预算”标志。
- 预算计算复用财务领域层的净额规则，退款、报销、转账、借贷和余额调整不能由页面各自判断。
- 存钱目标继续由真实转账反算进度，不采用 MoneyBook 把“存入”记为普通支出的做法；后者会降低当期结余并可能扭曲净资产。

### 4. 周期账与分期

`MoneyBook` 在单个数据库事务中逐期补齐到期账单，并对 1 月 31 日和 2 月 29 日做月末截断；`MyExpenses` 用唯一 WorkManager 任务、重叠时间窗和计划实例 ID 避免漏执行；`Cashew` 支持待支付、跳过和生成下一期。

采用建议：

- 每期生成稳定幂等键 `scheduleId + occurrenceDate`，不能只依赖可变的 `nextDate`。
- 一次执行在同一原子操作中完成“创建交易 + 记录期次 + 推进游标”。
- 支持结束日期/次数、暂停、跳过、提前执行、仅影响未来期次和可选删除已生成明细。
- 日期算法覆盖 28/29/30/31 日、闰年、时区变化和设备时间回拨。

### 5. 自动记账候选

`AutoAccounting` 使用“来源白名单 -> 文本过滤 -> 规则/AI 解析 -> 候选入库 -> 多渠道去重/合并 -> 编辑确认 -> 目标 App”管线，并为小星记账提供公开 URL Scheme 适配。其合并逻辑会优先保留已知账户和更具体名称，同时保留来源渠道。

采用建议：

- 保持智记现有安全边界：无障碍、通知和短信只生成候选，不能点击支付、不能静默写账。
- 候选保留原始来源、脱敏文本、提取字段、字段级置信度和解析器版本；确认后的交易保存候选 ID，形成可审计链路。
- 去重优先级依次为订单号/平台交易号、稳定指纹、跨渠道语义匹配；只有“同金额 + 时间窗”时只提示可能重复，不自动合并。
- 合并字段必须保留来源证据，不能用较长字符串无条件覆盖用户已确认数据。

不采用：Root、Xposed、LSPatch、Hook 支付应用数据库或绕过目标应用限制；不复制小星记账品牌、图标和私有行为。

### 6. WebDAV 与备份

`MyExpenses` 的 WebDAV 后端支持目录锁、锁失败后的兼容模式、远端元数据和逐资源同步。智记当前采用整包 AES-GCM 加密备份、设备修订号和冲突提示，结构更简单且符合个人本地版目标。

采用建议：

- 保留整包加密备份，不迁移到 MyExpenses 的逐记录协议。
- 上传前读取远端 `ETag`/修改时间，优先使用 `If-Match` 条件写入；服务不支持时继续使用现有修订号冲突保护。
- 上传新包前保留最近若干个加密快照；清理旧备份必须在新包可下载并可解密之后执行。
- 恢复顺序固定为：解析信封 -> 解密 -> schema 版本检查 -> 引用完整性检查 -> 临时态计算 -> 用户确认 -> 原子替换。
- 未知高版本、缺少必需集合、悬空账户/分类引用或错误密钥都不得覆盖本地数据。

## 小星记账可确认边界

- 官网公开描述包含本地运行、自动识别、资产负债、统计以及坚果云等云盘备份。
- `AutoAccounting` 固定提交中的 `XiaoXinAdapter` 通过 `xxjz://api/create` URL Scheme 传入类型、金额、账户、分类、账本、标签、商家、币种和时间。这是第三方适配实现，只能作为待真机验证的兼容线索，不能证明小星内部数据模型。
- 当前目标 APK 仍受加固保护。智记继续以可观察输入、结果、持久化和撤销行为做独立实现，不以反编译内容冒充源码。

## 许可证执行规则

- MIT 文件如被实质复制，必须在智记中保留原版权和许可声明，并记录精确来源提交。
- GPL-3.0 仓库默认只做思想、行为和测试场景参考。若未来需要复制实现，必须先由用户明确选择是否将对应衍生作品按 GPL-3.0 提供源码。
- 第三方截图、图标、文案和品牌素材不随源代码许可证自动获得授权，本项目不复制。
- 每次真正采用第三方代码前重新核对目标文件头、根许可证和固定提交，不能沿用本次快照的推断。

## 下一步

具体改造顺序、数据兼容和验收标准见 `docs/LOGIC_MIGRATION.md`。本审计本身不改变 App 行为、数据结构或 APK。
