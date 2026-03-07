# Fanqie Create Book Atomic

这个目录是“创建并绑定书本”的隔离版原子脚本，不改现有 [`/Volumes/Work/Projects/Morpheus/automation/fanqie-playwright`](/Volumes/Work/Projects/Morpheus/automation/fanqie-playwright)。

目标：

- 把创建书本拆成可单独执行的 step
- 提供 `guided` 串联模式，逐步告诉你该填什么、该点什么
- 在前置 `preflight` 阶段保守地执行“每日只能创建一本”的分流
- 把 `bookId` 的获取和绑定独立出来，便于单独调试

## 安装

```bash
cd /Volumes/Work/Projects/Morpheus/automation/fanqie-create-book-atomic
npm install
npx playwright install chromium
cp config/example.json config/local.json
```

如果你要直接用当前测试用 IDEA：

```bash
cp config/test-idea.json config/local.json
```

## 运行模式

### 1. 引导模式

```bash
npm run guided
```

默认顺序：

1. `preflight`
2. 若命中 bind-only：`detect-existing-books -> bind-book`
3. 若允许创建：`open-create -> fill-basic -> fill-tags -> fill-intro -> upload-cover -> await-submit -> capture-book-id -> bind-book`

### 2. 原子步骤

```bash
node src/index.js step preflight
node src/index.js step open-create
node src/index.js step fill-basic
node src/index.js step fill-tags
node src/index.js step fill-intro
node src/index.js step upload-cover
node src/index.js step await-submit
node src/index.js step capture-book-id
node src/index.js step bind-book
node src/index.js step bind-book 7600000000000000000
node src/index.js step detect-existing-books
```

说明：

- 单独跑 step 时，浏览器会重新启动，最可靠的用法仍然是 `guided`
- `bind-book` 可以直接传 `bookId`，也可以从 session 里的检测结果里选最新值
- `await-submit` 会先等待你人工确认/提交，再监听 `/api/author/book/create/`
- 创建页入口已对齐为 `https://fanqienovel.com/main/writer/create?enter_from=book_manage`
- 单独跑 `fill-tags` 时，脚本会先补齐书名/主角/目标读者，因为这个页面的标签弹窗依赖这些前置字段

## 状态文件

- `state/create-book-session.json`
  - 本次输入参数
  - 当前步骤结果
  - preflight 判定
  - 已检测到的 `bookId`
  - 绑定结果
- `state/create-book-result.json`
  - 最近一次 step 的结构化结果
- `state/book-ids.json`
  - 隔离版绑定状态历史
- `output/network/*.jsonl`
  - 网络日志，`capture-book-id` 会优先从这里抓取 `bookId`

## 配置重点

[`config/example.json`](/Volumes/Work/Projects/Morpheus/automation/fanqie-create-book-atomic/config/example.json) 沿用了老脚本的字段结构，并新增了：

- `flow.mode`
- `flow.bindOnlyOnPreflightHit`
- `paths.sessionPath`
- `paths.resultPath`
- `paths.boundBookStatePath`

常用字段：

- `book.title`
- `book.tags`
- `book.tagsByTab`
- `book.intro`
- `book.protagonist1`
- `book.protagonist2`
- `book.targetReader`
- `book.coverPath`
- `book.autoSubmit`

推荐优先使用 `book.tagsByTab`，因为你给的真实页面是“作品标签”弹窗，按 `主分类 / 主题 / 角色 / 情节` 分栏选择，脚本现在会：

1. 打开弹窗
2. 按 tab 切换
3. 逐个点击 `category-choose-item`
4. 最后统一点击一次“确认”

## `bookId` 获取顺序

`capture-book-id` 固定采用 network-first：

1. 解析 `await-submit` 生成的网络日志
2. 从创建响应 body / URL 里抓 `bookId`
3. 从当前页面 URL 抓
4. 从页面里的 `href` 抓
5. 从 performance resource URL 抓
6. 如果前面都拿不到，就先跑 `detect-existing-books`

## preflight 保守策略

首版默认值：`flow.bindOnlyOnPreflightHit=true`

现在的 `preflight` 已调整为更保守的真实可用策略：只有检测到明确的“每日/今日已创建上限”文案时，才阻断创建并转到绑定路径。单纯看到已有书本 `bookId` 只会记日志，不会阻断。

阻断后会转到：

```text
detect-existing-books -> bind-book
```

这样能避免作者后台已经有旧书时，脚本仍然被误判为不能创建新书。

## 测试

```bash
npm test
```

覆盖范围：

- `idDetection`
- `sessionStore`
- `preflight` 判定
- `bind-book` 目标选择
