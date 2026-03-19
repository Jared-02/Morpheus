/**
 * Error guidance framework: pattern-match generation errors
 * and return user-friendly Chinese guidance messages.
 */

interface ErrorGuidance {
    title: string
    suggestion: string
    severity: 'info' | 'warning' | 'error'
}

const patterns: Array<{ test: RegExp; guidance: ErrorGuidance }> = [
    {
        test: /timeout|timed?\s*out|ETIMEDOUT|ECONNABORTED/i,
        guidance: {
            title: '请求超时',
            suggestion: '生成任务耗时较长，请稍后重试或减少章节数量。',
            severity: 'warning',
        },
    },
    {
        test: /rate\s*limit|429|too\s*many\s*requests/i,
        guidance: {
            title: '请求频率受限',
            suggestion: 'API 调用频率过高，请等待 1-2 分钟后重试。',
            severity: 'warning',
        },
    },
    {
        test: /insufficient.*quota|balance|余额/i,
        guidance: {
            title: 'API 额度不足',
            suggestion: '当前 LLM 服务额度不足，请检查 API Key 余额。',
            severity: 'error',
        },
    },
    {
        test: /auth|unauthorized|401|api\s*key|invalid.*key/i,
        guidance: {
            title: '认证失败',
            suggestion: 'API Key 无效或已过期，请在后端 .env 中检查配置。',
            severity: 'error',
        },
    },
    {
        test: /model.*not\s*found|does\s*not\s*exist/i,
        guidance: {
            title: '模型不可用',
            suggestion: '指定的模型不存在，请检查 .env 中的模型配置。',
            severity: 'error',
        },
    },
    {
        test: /context.*length|token.*limit|max.*tokens/i,
        guidance: {
            title: '上下文长度超限',
            suggestion: '输入内容过长，建议缩短章节目标或减少记忆上下文。',
            severity: 'warning',
        },
    },
    {
        test: /network|ECONNREFUSED|ENOTFOUND|fetch\s*failed/i,
        guidance: {
            title: '网络连接失败',
            suggestion: '无法连接到 LLM 服务，请检查网络或代理设置。',
            severity: 'error',
        },
    },
    {
        test: /离线模式|offline/i,
        guidance: {
            title: '离线模式',
            suggestion: '当前处于离线模式，生成内容为占位文本。请配置 API Key 以启用在线生成。',
            severity: 'info',
        },
    },
    {
        test: /500|internal\s*server\s*error/i,
        guidance: {
            title: '服务器内部错误',
            suggestion: '后端处理异常，请查看服务端日志排查问题。',
            severity: 'error',
        },
    },
]

export function guideGenerationError(errorMessage: string): ErrorGuidance {
    for (const { test, guidance } of patterns) {
        if (test.test(errorMessage)) {
            return guidance
        }
    }
    return {
        title: '生成失败',
        suggestion: errorMessage || '未知错误，请查看控制台日志。',
        severity: 'error',
    }
}
