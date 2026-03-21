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

### 默认示例：DeepSeek（也支持 OpenAI-compatible 提供商）

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

> 注意：前端默认代理目标是 `http://localhost:8001`。如果你的后端跑在 `8000`，请显式启动：
>
> ```bash
> VITE_API_PROXY_TARGET=http://localhost:8000 npm run dev
> ```

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

## 6. 使用流程（当前多页面工作流）

1. **创建或进入项目** - 在项目列表页创建项目，填写题材、文风、梗概与禁忌约束。
2. **进入创作控制台** - 在 `/project/:projectId/write` 页面填写“创作方向（batch direction）”。
3. **点“开始生成”** - 选择模式、章节数、每章字数与自动审批后启动批量生成。
4. **查看流式结果** - 创作控制台会持续显示章节正文、日志与统计信息。
5. **进入章节工作台精修** - 在 `/project/:projectId/chapter/:chapterId` 查看蓝图、冲突与草稿，并按“修改方向”重做单章。

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

### LLM Provider 示例
- `deepseek-chat`（DeepSeek 默认示例路径）
- 也可切换到 OpenAI-compatible 提供商（按对应 provider 环境变量配置）

## 故障排除

### API 调用失败
- 检查 API Key 是否正确
- 确保账户有足够配额
- 查看日志中的具体错误信息

### Embedding 服务报错
- 确保 `EMBEDDING_MODEL` 与当前 provider/运行时路径匹配
- DeepSeek 示例路径使用 `deepseek-embedding`
- 本地优先模式下保持 `REMOTE_EMBEDDING_ENABLED=false` 可获得更稳定速度

### 前端无法连接后端
- 检查后端是否运行在正确端口 (默认 8000)
- 检查 Vite 代理配置
