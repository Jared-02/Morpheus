# 快速启动指南

## 1. 安装依赖

```bash
# 安装后端依赖
cd backend
poetry install

# 或者使用 pip
pip install -r requirements.txt

# 安装前端依赖
cd ../frontend
npm install
```

## 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

### 使用 DeepSeek (流式友好)

```bash
# .env 配置
LLM_PROVIDER=deepseek
REMOTE_LLM_ENABLED=true
DEEPSEEK_API_KEY=sk-your-deepseek-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

# Embedding 配置
EMBEDDING_MODEL=deepseek-embedding
EMBEDDING_DIMENSION=1536
REMOTE_EMBEDDING_ENABLED=false
```

提示：如果你不写 `REMOTE_LLM_ENABLED`，后端会在检测到可用 API Key 时自动启用远程模式。

## 3. 获取 DeepSeek API 密钥

1. 访问 https://platform.deepseek.com/
2. 注册/登录账号
3. 在控制台获取 API Key
4. 确保账户有足够的配额

## 4. 启动服务

```bash
# 启动后端 (在 backend 目录，推荐多 worker 防止生文阻塞读接口)
API_WORKERS=2 ./scripts/run_api.sh

# 启动前端 (在 frontend 目录)
npm run dev
```

可选日志配置（`backend/.env`）：

```bash
LOG_LEVEL=INFO
ENABLE_HTTP_LOGGING=true
LOG_FILE=../data/logs/app.log
```

## 5. 访问应用

打开浏览器访问 http://localhost:3000

验证是否真的在走远程模型：

```bash
curl http://127.0.0.1:8000/api/runtime/llm
```

关键字段应满足：
- `remote_effective: true`
- `remote_ready: true`
- `effective_provider` 与你期望的一致

## 6. 使用流程（新版单工作台）

1. **选择项目** - 顶部下拉直接切换，或点“新建项目”即时创建。
2. **一句话输入** - 在页面底部输入小说核心冲突与目标。
3. **点“开始生成”** - 默认即可跑通，模式/范围可用芯片快速切换。
4. **看中间正文流** - Markdown 正文在主区域持续更新，章节开始即有占位提示。
5. **右侧查看状态** - “任务”页看章节结果和日志，“记忆”页维护 L1，“调试”页看 Prompt 约束。

## 7. 调试接口（推荐）

```bash
# 查看当前模型运行状态
curl http://127.0.0.1:8000/api/runtime/llm

# 流式整卷/整本生成（SSE）
curl -N -X POST "http://127.0.0.1:8000/api/projects/<project_id>/one-shot-book/stream" \
  -H "Content-Type: application/json" \
  -d '{"batch_direction":"主角在雪夜被背叛后潜伏反击","mode":"studio","chapter_count":4,"words_per_chapter":1600,"auto_approve":true}'

# 查看 Prompt 和约束预览
curl -X POST "http://127.0.0.1:8000/api/projects/<project_id>/prompt-preview" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"主角在雪夜被背叛后潜伏反击","mode":"studio","chapter_count":4,"target_words":1600}'
```

## 支持的模型

### Embedding
- `deepseek-embedding` - DeepSeek 嵌入模型 (1536维)

### DeepSeek
- `deepseek-chat`

## 故障排除

### API 调用失败
- 检查 API Key 是否正确
- 确保账户有足够配额
- 查看日志中的具体错误信息

### Embedding 服务报错
- 确保 `EMBEDDING_MODEL` 与 provider 匹配
- DeepSeek 使用 `deepseek-embedding`
- 本地优先模式下保持 `REMOTE_EMBEDDING_ENABLED=false` 可获得更稳定速度

### 前端无法连接后端
- 检查后端是否运行在正确端口 (默认 8000)
- 检查 Vite 代理配置
