import os
import time
import logging
import json
import requests
from typing import Any, Callable, Dict, Iterator, List, Optional, Union
from enum import Enum


class LLMProvider(str, Enum):
    DEEPSEEK = "deepseek"
    OPENAI_COMPATIBLE = "openai_compatible"


class LLMConfig:
    def __init__(
        self,
        provider: LLMProvider = LLMProvider.DEEPSEEK,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: str = "deepseek-chat",
        embedding_model: str = "deepseek-embedding",
        embedding_dimension: int = 1536,
        chat_max_tokens: Optional[int] = None,
        chat_temperature: Optional[float] = None,
        context_window_tokens: Optional[int] = None,
    ):
        self.provider = provider
        self.embedding_model = embedding_model
        self.embedding_dimension = embedding_dimension

        # Generic defaults
        default_chat_max_tokens = _safe_positive_int(os.getenv("LLM_MAX_TOKENS"), 4000)
        default_chat_temperature = _safe_temperature(os.getenv("LLM_TEMPERATURE"), 0.7)
        default_context_window_tokens = _safe_positive_int(
            os.getenv("LLM_CONTEXT_WINDOW_TOKENS"),
            32768,
        )

        if provider == LLMProvider.OPENAI_COMPATIBLE:
            default_key = os.getenv("OPENAI_API_KEY")
            self.base_url = (
                base_url
                or os.getenv("OPENAI_BASE_URL")
                or "https://api.openai.com/v1"
            )
            self.model = model or "gpt-4o"
        else:
            default_key = os.getenv("DEEPSEEK_API_KEY")
            self.base_url = (
                base_url
                or os.getenv("DEEPSEEK_PROXY_URL")
                or os.getenv("DEEPSEEK_BASE_URL")
                or "https://api.deepseek.com"
            )
            self.model = model or "deepseek-chat"
            default_chat_max_tokens = _safe_positive_int(
                os.getenv("DEEPSEEK_MAX_TOKENS"), 8192
            )
            default_chat_temperature = _safe_temperature(
                os.getenv("DEEPSEEK_TEMPERATURE"),
                default_chat_temperature,
            )
            default_context_window_tokens = _safe_positive_int(
                os.getenv("DEEPSEEK_CONTEXT_WINDOW_TOKENS"),
                131072,
            )

        self.api_key = default_key if api_key is None else api_key

        self.chat_max_tokens = _safe_positive_int(
            chat_max_tokens,
            default_chat_max_tokens,
        )
        self.chat_temperature = _safe_temperature(
            chat_temperature,
            default_chat_temperature,
        )
        self.context_window_tokens = _safe_positive_int(
            context_window_tokens,
            default_context_window_tokens,
        )


def _safe_positive_int(value: Any, fallback: int) -> int:
    try:
        parsed = int(value)
        if parsed > 0:
            return parsed
    except (TypeError, ValueError):
        pass
    return fallback


def _safe_temperature(value: Any, fallback: float) -> float:
    try:
        parsed = float(value)
        if parsed < 0:
            return 0.0
        if parsed > 2:
            return 2.0
        return parsed
    except Exception:
        return fallback


def _estimate_tokens(text: str) -> int:
    """Rough token estimate: 1 CJK char ~ 1 token, 1 English word ~ 1.3 tokens."""
    try:
        import tiktoken

        enc = tiktoken.get_encoding("cl100k_base")
        return len(enc.encode(text))
    except Exception:
        cjk = sum(1 for ch in text if "\u4e00" <= ch <= "\u9fff")
        ascii_words = len(text.encode("ascii", errors="ignore").split())
        return cjk + int(ascii_words * 1.3)


class UsageInfo:
    """Token usage report passed to on_usage callbacks."""

    __slots__ = ("prompt_tokens", "completion_tokens", "total_tokens", "estimated")

    def __init__(
        self,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        total_tokens: int = 0,
        estimated: bool = False,
    ):
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens
        self.total_tokens = total_tokens or (prompt_tokens + completion_tokens)
        self.estimated = estimated

    def to_dict(self) -> Dict[str, Any]:
        return {
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
            "estimated": self.estimated,
        }


class LLMClient:
    def __init__(self, config: LLMConfig):
        self.config = config
        self._client = None
        self._logger = logging.getLogger("novelist.llm")
        self._offline_warnings: set[str] = set()
        self._last_chat_meta: Dict[str, Any] = {}
        self._http_timeout = 60

    def _get_openai_client(self):
        """Lazy-initialize OpenAI SDK client."""
        if self._client is None:
            from openai import OpenAI

            self._client = OpenAI(
                api_key=self.config.api_key,
                base_url=self.config.base_url,
                timeout=self._http_timeout,
            )
        return self._client

    def _set_last_chat_meta(self, **kwargs: Any):
        self._last_chat_meta = dict(kwargs)

    def get_last_chat_meta(self) -> Dict[str, Any]:
        return dict(self._last_chat_meta or {})

    def _warn_offline_once(self, reason: str):
        if reason in self._offline_warnings:
            return
        self._offline_warnings.add(reason)
        self._logger.warning(
            "llm offline fallback provider=%s model=%s reason=%s",
            self.config.provider.value,
            self.config.model,
            reason,
        )

    def _request_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }

    def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stream: bool = False,
    ) -> Union[str, Any]:
        if not self.config.api_key:
            self._warn_offline_once("missing_api_key")
            self._set_last_chat_meta(
                mode="offline",
                reason="missing_api_key",
                provider=self.config.provider.value,
                model=self.config.model,
            )
            return self._offline_chat(messages)

        started = time.perf_counter()
        try:
            actual_max_tokens = _safe_positive_int(max_tokens, self.config.chat_max_tokens)
            actual_temperature = _safe_temperature(temperature, self.config.chat_temperature)
            client = self._get_openai_client()
            response = client.chat.completions.create(
                model=self.config.model,
                messages=messages,
                temperature=actual_temperature,
                max_tokens=actual_max_tokens,
                stream=bool(stream),
            )

            if stream:
                return response

            content = response.choices[0].message.content if response.choices else None
            if not isinstance(content, str):
                raise ValueError("chat response missing content")
            usage = getattr(response, "usage", None)
            self._set_last_chat_meta(
                mode="remote",
                reason="success",
                provider=self.config.provider.value,
                model=self.config.model,
                latency_ms=(time.perf_counter() - started) * 1000,
                chars=len(content or ""),
                usage=usage.model_dump() if usage else None,
            )
            self._logger.info(
                "llm chat remote success provider=%s model=%s latency_ms=%.2f chars=%d",
                self.config.provider.value,
                self.config.model,
                (time.perf_counter() - started) * 1000,
                len(content or ""),
            )
            return content
        except Exception as exc:
            self._set_last_chat_meta(
                mode="offline",
                reason="remote_exception",
                provider=self.config.provider.value,
                model=self.config.model,
                error=str(exc)[:280],
            )
            self._logger.warning(
                "llm chat remote failed provider=%s model=%s error=%s fallback=offline",
                self.config.provider.value,
                self.config.model,
                exc,
            )
            return self._offline_chat(messages)

    def chat_stream_text(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        on_usage: Optional[Callable[["UsageInfo"], Any]] = None,
    ) -> Iterator[str]:
        if not self.config.api_key:
            self._warn_offline_once("missing_api_key")
            offline = self._offline_chat(messages)
            for ch in offline:
                yield ch
            return

        started = time.perf_counter()
        emitted_chars = 0
        try:
            stream_response = self.chat(
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
            )
            usage_data = None
            for chunk in stream_response:
                text = self._extract_sdk_delta_text(chunk)
                if text:
                    emitted_chars += len(text)
                    yield text
                chunk_usage = getattr(chunk, "usage", None)
                if chunk_usage:
                    usage_data = chunk_usage

            self._logger.info(
                "llm chat remote stream done provider=%s model=%s latency_ms=%.2f chars=%d",
                self.config.provider.value,
                self.config.model,
                (time.perf_counter() - started) * 1000,
                emitted_chars,
            )

            if on_usage:
                if usage_data:
                    info = UsageInfo(
                        prompt_tokens=getattr(usage_data, "prompt_tokens", 0) or 0,
                        completion_tokens=getattr(usage_data, "completion_tokens", 0) or 0,
                        total_tokens=getattr(usage_data, "total_tokens", 0) or 0,
                    )
                else:
                    prompt_text = " ".join(m.get("content", "") for m in messages)
                    info = UsageInfo(
                        prompt_tokens=_estimate_tokens(prompt_text),
                        completion_tokens=_estimate_tokens("a" * emitted_chars),
                        estimated=True,
                    )
                    info.total_tokens = info.prompt_tokens + info.completion_tokens
                try:
                    on_usage(info)
                except Exception:
                    self._logger.debug("on_usage callback failed", exc_info=True)
        except Exception as exc:
            self._logger.warning(
                "llm chat remote stream failed provider=%s model=%s error=%s fallback=offline",
                self.config.provider.value,
                self.config.model,
                exc,
            )
            offline = self._offline_chat(messages)
            for ch in offline:
                yield ch

    def embed_text(self, text: str) -> List[float]:
        return self._embed_via_api(text)

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return self._embed_batch_via_api(texts)

    def _embed_via_api(self, text: str) -> List[float]:
        if not self.config.api_key:
            self._warn_offline_once("embedding_missing_api_key")
            return self._offline_embedding(text)
        try:
            response = requests.post(
                f"{self.config.base_url}/embeddings",
                headers=self._request_headers(),
                json={"model": self.config.embedding_model, "input": text},
                timeout=self._http_timeout,
            )
            response.raise_for_status()
            body = response.json()
            data = (body.get("data") or [{}])[0] if isinstance(body, dict) else {}
            embedding = data.get("embedding") if isinstance(data, dict) else None
            if not isinstance(embedding, list):
                raise ValueError("embedding response missing embedding")
            return embedding
        except Exception as exc:
            self._logger.warning(
                "embedding remote failed provider=%s model=%s error=%s fallback=offline",
                self.config.provider.value,
                self.config.embedding_model,
                exc,
            )
            return self._offline_embedding(text)

    def _embed_batch_via_api(self, texts: List[str]) -> List[List[float]]:
        if not self.config.api_key:
            self._warn_offline_once("embedding_batch_missing_api_key")
            return [self._offline_embedding(text) for text in texts]
        try:
            response = requests.post(
                f"{self.config.base_url}/embeddings",
                headers=self._request_headers(),
                json={"model": self.config.embedding_model, "input": texts},
                timeout=self._http_timeout,
            )
            response.raise_for_status()
            body = response.json()
            data = body.get("data") if isinstance(body, dict) else None
            if not isinstance(data, list):
                raise ValueError("embedding batch response missing data")
            embeddings: List[List[float]] = []
            for item in data:
                if not isinstance(item, dict) or not isinstance(item.get("embedding"), list):
                    raise ValueError("embedding batch item malformed")
                embeddings.append(item["embedding"])
            return embeddings
        except Exception as exc:
            self._logger.warning(
                "embedding batch remote failed provider=%s model=%s error=%s fallback=offline",
                self.config.provider.value,
                self.config.embedding_model,
                exc,
            )
            return [self._offline_embedding(text) for text in texts]

    def _offline_chat(self, messages: List[Dict[str, str]]) -> str:
        user_parts = [m.get("content", "") for m in messages if m.get("role") == "user"]
        payload = user_parts[-1] if user_parts else ""
        instruction = ""
        if payload:
            try:
                parsed = json.loads(payload)
                instruction = str(parsed.get("instruction", "")).strip()
            except Exception:
                instruction = ""

        if "\u8f93\u51fa\u7eaf\u6b63\u6587" in instruction or "\u6700\u7ec8\u7ae0\u8282\u6b63\u6587" in instruction:
            return "\u3010\u79bb\u7ebf\u8349\u7a3f\u3011\u5bd2\u98ce\u63a0\u8fc7\u957f\u8857\uff0c\u4e3b\u89d2\u5728\u96ea\u591c\u91cc\u610f\u8bc6\u5230\u80cc\u53db\u5df2\u6210\u5b9a\u5c40\u3002"
        if "\u6da6\u8272" in instruction:
            return "\u3010\u79bb\u7ebf\u6da6\u8272\u3011\u53e5\u5f0f\u5df2\u538b\u7f29\uff0c\u6c1b\u56f4\u4e0e\u8282\u594f\u589e\u5f3a\uff0c\u4e8b\u5b9e\u8bbe\u5b9a\u4fdd\u6301\u4e0d\u53d8\u3002"
        if "\u6307\u51fa\u672c\u7a3f\u53ef\u80fd\u8fdd\u53cd\u8bbe\u5b9a" in instruction:
            return "\u3010\u79bb\u7ebf\u5ba1\u6821\u3011\u672a\u8fde\u63a5\u6a21\u578b\uff0c\u5efa\u8bae\u91cd\u70b9\u6838\u5bf9\u4e16\u754c\u89c4\u5219\u3001\u4eba\u7269\u72b6\u6001\u4e0e\u65f6\u95f4\u7ebf\u3002"

        return "\u3010\u79bb\u7ebf\u5360\u4f4d\u8f93\u51fa\u3011\u672a\u914d\u7f6e\u53ef\u7528\u6a21\u578b\uff0c\u5df2\u8fd4\u56de\u6700\u5c0f\u5360\u4f4d\u7ed3\u679c\u3002"

    @staticmethod
    def _extract_sdk_delta_text(chunk: Any) -> str:
        """Extract text from an OpenAI SDK ChatCompletionChunk."""
        try:
            choices = getattr(chunk, "choices", None)
            if not choices:
                return ""
            delta = getattr(choices[0], "delta", None)
            if delta is None:
                return ""
            content = getattr(delta, "content", None)
            return content if isinstance(content, str) else ""
        except Exception:
            return ""

    def _offline_embedding(self, text: str, dim: Optional[int] = None) -> List[float]:
        import hashlib

        size = dim or self.config.embedding_dimension
        vector = [0.0] * size
        digest = hashlib.sha256(text.encode("utf-8")).digest()
        for idx in range(size):
            vector[idx] = digest[idx % len(digest)] / 255.0
        return vector


_PROVIDER_MAP = {
    "deepseek": LLMProvider.DEEPSEEK,
    "openai": LLMProvider.OPENAI_COMPATIBLE,
    "openai_compatible": LLMProvider.OPENAI_COMPATIBLE,
}


def create_llm_client(provider: str = "deepseek", **kwargs) -> LLMClient:
    candidate = (provider or "deepseek").strip().lower()
    llm_provider = _PROVIDER_MAP.get(candidate)
    if llm_provider is None:
        logging.getLogger("novelist.llm").warning(
            "unsupported llm provider=%s fallback=deepseek",
            provider,
        )
        llm_provider = LLMProvider.DEEPSEEK
    config = LLMConfig(provider=llm_provider, **kwargs)
    return LLMClient(config)
