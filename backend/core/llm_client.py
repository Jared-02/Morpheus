import os
import time
import logging
import json
import requests
from typing import List, Optional, Dict, Any, Union, Iterator
from enum import Enum


class LLMProvider(str, Enum):
    DEEPSEEK = "deepseek"


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
        default_key = os.getenv("DEEPSEEK_API_KEY")
        self.api_key = default_key if api_key is None else api_key
        self.model = model
        self.embedding_model = embedding_model
        self.embedding_dimension = embedding_dimension
        default_chat_max_tokens = _safe_positive_int(os.getenv("LLM_MAX_TOKENS"), 4000)
        default_chat_temperature = _safe_temperature(os.getenv("LLM_TEMPERATURE"), 0.7)
        default_context_window_tokens = _safe_positive_int(
            os.getenv("LLM_CONTEXT_WINDOW_TOKENS"),
            32768,
        )

        self.base_url = base_url or os.getenv("DEEPSEEK_BASE_URL") or "https://api.deepseek.com"
        self.model = model or "deepseek-chat"
        default_chat_max_tokens = _safe_positive_int(os.getenv("DEEPSEEK_MAX_TOKENS"), 8192)
        default_chat_temperature = _safe_temperature(
            os.getenv("DEEPSEEK_TEMPERATURE"),
            default_chat_temperature,
        )
        default_context_window_tokens = _safe_positive_int(
            os.getenv("DEEPSEEK_CONTEXT_WINDOW_TOKENS"),
            131072,
        )

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


class LLMClient:
    def __init__(self, config: LLMConfig):
        self.config = config
        self._client = None
        self._logger = logging.getLogger("novelist.llm")
        self._offline_warnings: set[str] = set()
        self._last_chat_meta: Dict[str, Any] = {}
        self._http_timeout = 60

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
            payload = {
                "model": self.config.model,
                "messages": messages,
                "temperature": actual_temperature,
                "max_tokens": actual_max_tokens,
                "stream": bool(stream),
            }
            response = requests.post(
                f"{self.config.base_url}/chat/completions",
                headers=self._request_headers(),
                json=payload,
                timeout=self._http_timeout,
                stream=bool(stream),
            )
            response.raise_for_status()

            if stream:
                return response

            body = response.json()
            content = (
                ((body.get("choices") or [{}])[0].get("message") or {}).get("content")
                if isinstance(body, dict)
                else None
            )
            if not isinstance(content, str):
                raise ValueError("chat response missing content")
            self._set_last_chat_meta(
                mode="remote",
                reason="success",
                provider=self.config.provider.value,
                model=self.config.model,
                latency_ms=(time.perf_counter() - started) * 1000,
                chars=len(content or ""),
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
            response = self.chat(
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
            )
            if not isinstance(response, requests.Response):
                raise ValueError("stream response is invalid")
            for line in response.iter_lines(decode_unicode=True):
                if not line:
                    continue
                raw = line.strip()
                if not raw.startswith("data:"):
                    continue
                data_part = raw[5:].strip()
                if data_part == "[DONE]":
                    break
                try:
                    payload = json.loads(data_part)
                except Exception:
                    continue
                text = self._extract_stream_delta_text(payload)
                if text:
                    emitted_chars += len(text)
                    yield text
            self._logger.info(
                "llm chat remote stream done provider=%s model=%s latency_ms=%.2f chars=%d",
                self.config.provider.value,
                self.config.model,
                (time.perf_counter() - started) * 1000,
                emitted_chars,
            )
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
        return self._embed_deepseek(text)

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return self._embed_batch_deepseek(texts)

    def _embed_deepseek(self, text: str) -> List[float]:
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

    def _embed_batch_deepseek(self, texts: List[str]) -> List[List[float]]:
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
        # Keep offline outputs compact and avoid leaking full prompts/context into user-visible drafts.
        user_parts = [m.get("content", "") for m in messages if m.get("role") == "user"]
        payload = user_parts[-1] if user_parts else ""
        instruction = ""
        if payload:
            try:
                import json

                parsed = json.loads(payload)
                instruction = str(parsed.get("instruction", "")).strip()
            except Exception:
                instruction = ""

        if "输出纯正文" in instruction or "最终章节正文" in instruction:
            return "【离线草稿】寒风掠过长街，主角在雪夜里意识到背叛已成定局。"
        if "润色" in instruction:
            return "【离线润色】句式已压缩，氛围与节奏增强，事实设定保持不变。"
        if "指出本稿可能违反设定" in instruction:
            return "【离线审校】未连接模型，建议重点核对世界规则、人物状态与时间线。"

        return "【离线占位输出】未配置可用模型，已返回最小占位结果。"

    def _extract_stream_delta_text(self, chunk: Any) -> str:
        try:
            choices = chunk.get("choices") if isinstance(chunk, dict) else None
            if choices:
                first = choices[0] if isinstance(choices[0], dict) else {}
                delta = first.get("delta") if isinstance(first, dict) else None
                if delta is not None:
                    content = delta.get("content") if isinstance(delta, dict) else None
                    if isinstance(content, str):
                        return content
                    if isinstance(content, list):
                        parts: List[str] = []
                        for item in content:
                            text = item.get("text") if isinstance(item, dict) else None
                            if isinstance(text, str):
                                parts.append(text)
                        return "".join(parts)
                message = first.get("message") if isinstance(first, dict) else None
                if message is not None:
                    msg_content = message.get("content") if isinstance(message, dict) else None
                    if isinstance(msg_content, str):
                        return msg_content
        except Exception:
            return ""
        return ""

    def _offline_embedding(self, text: str, dim: Optional[int] = None) -> List[float]:
        import hashlib

        size = dim or self.config.embedding_dimension
        vector = [0.0] * size
        digest = hashlib.sha256(text.encode("utf-8")).digest()
        for idx in range(size):
            vector[idx] = digest[idx % len(digest)] / 255.0
        return vector


def create_llm_client(provider: str = "deepseek", **kwargs) -> LLMClient:
    candidate = (provider or "deepseek").strip().lower()
    if candidate != LLMProvider.DEEPSEEK.value:
        logging.getLogger("novelist.llm").warning(
            "unsupported llm provider=%s fallback=deepseek",
            provider,
        )
    llm_provider = LLMProvider.DEEPSEEK
    config = LLMConfig(provider=llm_provider, **kwargs)
    return LLMClient(config)
