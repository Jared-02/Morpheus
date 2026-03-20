import types

from core.llm_client import LLMClient, LLMConfig, LLMProvider, _estimate_tokens, create_llm_client


class FakeChunk:
    def __init__(self, content: str = "", usage=None):
        self.choices = [types.SimpleNamespace(delta=types.SimpleNamespace(content=content))]
        self.usage = usage


class FakeStream:
    def __init__(self, chunks):
        self._chunks = list(chunks)
        self.closed = False

    def __iter__(self):
        return iter(self._chunks)

    def close(self):
        self.closed = True


class FakeClient:
    def __init__(self, *, response=None, exc=None):
        self._response = response
        self._exc = exc
        self.calls = []
        self.chat = types.SimpleNamespace(completions=types.SimpleNamespace(create=self.create))

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if self._exc:
            raise self._exc
        return self._response


def test_chat_stream_text_falls_back_to_offline_text_when_stream_creation_fails():
    client = LLMClient(LLMConfig(provider=LLMProvider.DEEPSEEK, api_key="k"))
    client._client = FakeClient(exc=RuntimeError("boom"))

    chunks = list(client.chat_stream_text([{"role": "user", "content": '{"instruction":"输出纯正文"}'}]))

    assert "".join(chunks).startswith("【离线草稿】")


def test_chat_stream_text_reports_estimated_usage_when_stream_creation_fails():
    client = LLMClient(LLMConfig(provider=LLMProvider.DEEPSEEK, api_key="k"))
    client._client = FakeClient(exc=RuntimeError("boom"))

    usage_reports = []
    chunks = list(
        client.chat_stream_text(
            [{"role": "user", "content": '{"instruction":"输出纯正文"}'}],
            on_usage=usage_reports.append,
        )
    )

    emitted_text = "".join(chunks)
    assert emitted_text.startswith("【离线草稿】")
    assert len(usage_reports) == 1
    assert usage_reports[0].estimated is True
    assert usage_reports[0].completion_tokens == _estimate_tokens(emitted_text)


def test_openai_compatible_defaults_apply_when_model_fields_omitted():
    config = LLMConfig(
        provider=LLMProvider.OPENAI_COMPATIBLE,
        api_key="k",
        model="",
        embedding_model="",
    )

    assert config.model == "gpt-4o"
    assert config.embedding_model == "text-embedding-3-small"


def test_chat_stream_text_estimates_usage_from_real_emitted_text_and_closes_stream():
    stream = FakeStream([FakeChunk("你好"), FakeChunk("世界")])
    fake_client = FakeClient(response=stream)
    client = LLMClient(LLMConfig(provider=LLMProvider.OPENAI_COMPATIBLE, api_key="k", model="gpt-4o"))
    client._client = fake_client

    usage_reports = []
    chunks = list(
        client.chat_stream_text(
            [{"role": "user", "content": "hello world"}],
            on_usage=usage_reports.append,
        )
    )

    assert "".join(chunks) == "你好世界"
    assert len(usage_reports) == 1
    assert usage_reports[0].estimated is True
    assert usage_reports[0].completion_tokens == _estimate_tokens("你好世界")
    assert fake_client.calls[0]["stream"] is True
    assert fake_client.calls[0]["stream_options"] == {"include_usage": True}
    assert stream.closed is True


def test_chat_stream_text_omits_stream_options_for_non_openai_compatible_provider():
    stream = FakeStream([FakeChunk("你好")])
    fake_client = FakeClient(response=stream)
    client = LLMClient(LLMConfig(provider=LLMProvider.DEEPSEEK, api_key="k", model="deepseek-chat"))
    client._client = fake_client

    chunks = list(client.chat_stream_text([{"role": "user", "content": "hello world"}]))

    assert "".join(chunks) == "你好"
    assert fake_client.calls[0]["stream"] is True
    assert "stream_options" not in fake_client.calls[0]


def test_create_llm_client_maps_minimax_to_openai_compatible_provider():
    client = create_llm_client(
        provider="minimax",
        api_key="k",
        model="MiniMax-M2.5",
        base_url="https://api.minimaxi.com/v1",
        embedding_model="embo-01",
    )

    assert client.config.provider == LLMProvider.OPENAI_COMPATIBLE
    assert client.config.model == "MiniMax-M2.5"
    assert client.config.base_url == "https://api.minimaxi.com/v1"
    assert client.config.embedding_model == "embo-01"


def test_chat_stream_text_omits_stream_options_for_minimax_base_url():
    stream = FakeStream([FakeChunk("你好")])
    fake_client = FakeClient(response=stream)
    client = create_llm_client(
        provider="minimax",
        api_key="k",
        model="MiniMax-M2.5",
        base_url="https://api.minimaxi.com/v1",
    )
    client._client = fake_client

    chunks = list(client.chat_stream_text([{"role": "user", "content": "hello world"}]))

    assert "".join(chunks) == "你好"
    assert fake_client.calls[0]["stream"] is True
    assert "stream_options" not in fake_client.calls[0]
