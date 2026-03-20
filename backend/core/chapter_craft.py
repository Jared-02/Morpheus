import re
from typing import Any, Dict, Iterable, List, Optional, Set, TYPE_CHECKING

if TYPE_CHECKING:
    from models import Conflict, EntityState, EventEdge


_CHAPTER_PREFIX_CN_RE = re.compile(
    r"^\s*(?:#\s*)?(?:第\s*[0-9一二三四五六七八九十百千零〇两IVXLCMivxlcm]+\s*[章节卷部]\s*[：:\-\s]*)"
)
_CHAPTER_PREFIX_EN_RE = re.compile(
    r"^\s*(?:#\s*)?(?:chapter|ch\.)\s*[0-9ivxlcm]+\s*[：:\-\s]*", re.IGNORECASE
)
_MULTI_SPACE_RE = re.compile(r"\s+")
_TITLE_SPLIT_RE = re.compile(r"[，。！？；：:、（）()【】\[\]<>《》“”\"'‘’|/\\\-—_]+")
_LEADING_BULLET_RE = re.compile(r"^[\s\-•*\d.、:：]+")
_PHASE_TEMPLATE_TITLE_RE = re.compile(
    r"^(?:起势递进|代价扩张|阶段收束|铺设与触发|压力升级|反转与逼近|收束与续钩)"
    r"(?:[·:：\-\s]*[0-9一二三四五六七八九十百千零〇两IVXLCMivxlcm]+)?$"
)
_PROCESS_LABEL_TITLE_RE = re.compile(
    r"^(?:阶段)?(?:推进|收束|发展|转折|高潮|里程碑)"
    r"(?:[·:：\-\s]*[0-9一二三四五六七八九十百千零〇两IVXLCMivxlcm]+)?$"
)
_OUTLINE_ACTION_TITLE_RE = re.compile(
    r"^(?:引入|推进|回收|建立|绑定|触发|收束|升级|兑现|保留).*(?:目标|冲突|钩子|伏笔|主线|支线)$"
)
_DISALLOWED_TITLE_FRAGMENT_RE = re.compile(
    r"(?:起势递进|代价扩张|阶段收束|里程碑|第二阶段钩子|阶段钩子|收束阶段)"
)
_INSTRUCTIONAL_TITLE_RE = re.compile(
    r"^(?:主角|角色|主人公|男主|女主|围绕|根据|通过|为了|试图|决定|被迫|继续|开始).{2,}$"
)

_GENERIC_TITLES = {
    "开端",
    "开始",
    "继续",
    "发展",
    "推进",
    "冲突",
    "转折",
    "真相",
    "高潮",
    "收束",
    "尾声",
    "序章",
    "正文",
    "章节",
    "本章",
    "下一章",
    "未命名",
    "起势递进",
    "代价扩张",
    "阶段收束",
    "铺设与触发",
    "压力升级",
    "反转与逼近",
    "收束与续钩",
}

_TITLE_STOPWORDS = {
    "本章",
    "这一章",
    "本回",
    "角色",
    "事件",
    "进行",
    "发生",
    "推进",
    "继续",
    "需要",
    "开始",
    "结束",
    "处理",
    "完成",
    "最后",
    "目前",
    "当前",
    "以及",
    "并且",
    "但是",
    "然后",
    "因为",
    "所以",
}
_TITLE_BAD_PREFIXES = {"在", "从", "将", "把", "对", "给", "向", "为", "于", "并", "且"}


def compute_length_bounds(target_words: int) -> Dict[str, int]:
    target = max(int(target_words or 0), 300)
    lower = max(300, int(target * 0.86))
    ideal_low = max(lower, int(target * 0.93))
    ideal_high = max(ideal_low + 80, int(target * 1.08))
    soft_upper = max(ideal_high + 200, int(target * 1.25))
    return {
        "target": target,
        "lower": lower,
        "ideal_low": ideal_low,
        "ideal_high": ideal_high,
        "soft_upper": soft_upper,
    }


def build_micro_arc_hint(
    *,
    chapter_number: int,
    target_words: int,
    continuation_mode: bool,
) -> Dict[str, Any]:
    bounds = compute_length_bounds(target_words)
    phase_idx = (max(chapter_number, 1) - 1) % 4
    phase_name = ["起势抛钩", "对抗升级", "反转失衡", "代价余震"][phase_idx]

    hook_rule = (
        "章尾必须保留下一章可执行动作，不得终结全书主线。"
        if continuation_mode
        else "章尾保留未决信息或危机余波。"
    )

    return {
        "phase": phase_name,
        "structure": [
            {
                "segment": "开场触发",
                "ratio": "15%-20%",
                "requirement": "前20%内给出本章明确问题与行动目标",
            },
            {
                "segment": "推进对抗",
                "ratio": "40%-50%",
                "requirement": "至少一次主动决策导致代价上升",
            },
            {
                "segment": "反转或新信息",
                "ratio": "20%-25%",
                "requirement": "抛出改变局势的事实/关系位移",
            },
            {
                "segment": "余震与钩子",
                "ratio": "10%-15%",
                "requirement": hook_rule,
            },
        ],
        "forbidden": [
            "前60%无有效冲突",
            "单章内同时解决所有核心问题",
            "把设定解释替代戏剧动作",
        ],
        "length": bounds,
    }


def build_outline_phase_hints(chapter_count: int, continuation_mode: bool) -> List[Dict[str, str]]:
    total = max(1, int(chapter_count or 1))
    hints: List[Dict[str, str]] = []

    for idx in range(total):
        position = (idx + 1) / total
        if continuation_mode:
            if position <= 0.3:
                phase = "起势递进"
                focus = "引入新异常并绑定角色目标"
            elif position <= 0.7:
                phase = "代价扩张"
                focus = "冲突升级且代价外溢，避免主线完结"
            else:
                phase = "阶段收束"
                focus = "回收局部伏笔并留下更大钩子"
        else:
            if position <= 0.2:
                phase = "铺设与触发"
                focus = "建立核心问题与关键人物立场"
            elif position <= 0.55:
                phase = "压力升级"
                focus = "连续决策导致局势恶化"
            elif position <= 0.85:
                phase = "反转与逼近"
                focus = "揭露误导并逼近核心真相"
            else:
                phase = "收束与续钩"
                focus = "兑现局部结果并留下后续驱动力"

        hints.append(
            {
                "chapter_index": str(idx + 1),
                "phase": phase,
                "focus": focus,
            }
        )

    return hints


def strip_chapter_prefix(value: str) -> str:
    text = (value or "").strip()
    if not text:
        return ""
    text = re.sub(r"^#+\s*", "", text).strip()
    text = _CHAPTER_PREFIX_CN_RE.sub("", text).strip()
    text = _CHAPTER_PREFIX_EN_RE.sub("", text).strip()
    return text


def _normalize_title_base(value: str) -> str:
    text = strip_chapter_prefix(value)
    text = _LEADING_BULLET_RE.sub("", text).strip()
    text = _MULTI_SPACE_RE.sub(" ", text).strip()
    text = text.strip("，。！？；：:、-—_·. ")
    return text


def _is_bad_title(value: str) -> bool:
    text = _normalize_title_base(value)
    if not text:
        return True
    if text in _GENERIC_TITLES:
        return True
    if _PHASE_TEMPLATE_TITLE_RE.fullmatch(text):
        return True
    if _PROCESS_LABEL_TITLE_RE.fullmatch(text):
        return True
    if _OUTLINE_ACTION_TITLE_RE.fullmatch(text):
        return True
    if _DISALLOWED_TITLE_FRAGMENT_RE.search(text):
        return True
    if _INSTRUCTIONAL_TITLE_RE.match(text):
        return True
    if "的线索" in text:
        return True
    if len(text) < 3:
        return True
    if re.fullmatch(r"[0-9一二三四五六七八九十百千零〇两IVXLCMivxlcm]+", text):
        return True
    if text.lower() in {"chapter", "untitled", "title"}:
        return True
    return False


def _select_goal_phrase(goal: str) -> str:
    raw = (goal or "").strip()
    raw = strip_chapter_prefix(raw)
    raw = re.sub(r"^围绕[“\"].*?[”\"]推进[：:]\s*", "", raw)
    raw = re.sub(r"^围绕.+?推进[：:]\s*", "", raw)
    raw = re.sub(r"\s+", "", raw)
    if not raw:
        return ""

    segments = [seg.strip() for seg in _TITLE_SPLIT_RE.split(raw) if seg and seg.strip()]
    if not segments:
        segments = [raw]

    best = ""
    best_score = -1
    for seg in segments:
        candidate = seg
        if not candidate:
            continue
        candidate = candidate[:18]
        score = 0
        length = len(candidate)
        if 3 <= length <= 16:
            score += 3
            if 6 <= length <= 12:
                score += 1
        elif length <= 2:
            score -= 4
        else:
            score -= 2
        if not any(sw in candidate for sw in _TITLE_STOPWORDS):
            score += 2
        if candidate[:1] in _TITLE_BAD_PREFIXES:
            score -= 2
        if re.search(r"[A-Za-z0-9一-龥]", candidate):
            score += 1
        if score > best_score:
            best = candidate
            best_score = score
    return best.strip("，。！？；：:、-—_·. ")


def derive_title_from_goal(goal: str, chapter_number: int, phase: Optional[str] = None) -> str:
    phrase = _select_goal_phrase(goal)
    if phrase and not _is_bad_title(phrase):
        return phrase[:20]

    if phase:
        phase_candidate = _normalize_title_base(phase)
        if phase_candidate and not _is_bad_title(phase_candidate):
            return phase_candidate[:18]

    fallback_bank = ["异响", "盲区", "裂缝", "回声", "错位", "重影", "阈值", "倒计时"]
    suffix_bank = ["之夜", "逼近", "回响", "之后"]
    idx = max(chapter_number, 1) - 1
    word = fallback_bank[idx % len(fallback_bank)]
    suffix = suffix_bank[idx % len(suffix_bank)]
    return f"{word}{suffix}"


def _derive_fallback_title_by_index(index: int) -> str:
    fallback_bank = ["异响", "盲区", "裂缝", "回声", "错位", "重影", "阈值", "倒计时"]
    suffix_bank = ["之夜", "逼近", "回响", "之后"]
    idx = max(index, 1) - 1
    word = fallback_bank[idx % len(fallback_bank)]
    suffix = suffix_bank[idx % len(suffix_bank)]
    return f"{word}{suffix}"


def _score_title_candidate(candidate: str) -> int:
    score = 0
    length = len(candidate)
    if 3 <= length <= 16:
        score += 3
        if 6 <= length <= 12:
            score += 1
    elif length <= 2:
        score -= 4
    else:
        score -= 2
    if not any(sw in candidate for sw in _TITLE_STOPWORDS):
        score += 2
    if candidate[:1] in _TITLE_BAD_PREFIXES:
        score -= 2
    if re.search(r"[A-Za-z0-9一-龥]", candidate):
        score += 1
    return score


def _build_alternative_title_candidates(goal: str) -> List[str]:
    raw = (goal or "").strip()
    raw = strip_chapter_prefix(raw)
    raw = re.sub(r"^围绕[“\"].*?[”\"]推进[：:]\s*", "", raw)
    raw = re.sub(r"^围绕.+?推进[：:]\s*", "", raw)
    raw = re.sub(r"\s+", "", raw)
    if not raw:
        return []

    segments = [seg.strip() for seg in _TITLE_SPLIT_RE.split(raw) if seg and seg.strip()]
    if not segments:
        segments = [raw]

    scored: List[tuple[int, str]] = []
    seen: Set[str] = set()
    for seg in segments:
        candidate = seg[:18].strip("，。！？；：:、-—_·. ")
        if not candidate or candidate in seen:
            continue
        seen.add(candidate)
        scored.append((_score_title_candidate(candidate), candidate))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [item[1] for item in scored]


def normalize_chapter_title(
    *,
    raw_title: str,
    goal: str,
    chapter_number: int,
    used_titles: Optional[Set[str]] = None,
    phase: Optional[str] = None,
) -> str:
    title = _normalize_title_base(raw_title)
    if _is_bad_title(title):
        title = derive_title_from_goal(goal, chapter_number, phase=phase)

    if len(title) > 16:
        title = title[:16].rstrip("，。！？；：:、-—_·. ")
    if _is_bad_title(title):
        title = derive_title_from_goal(goal, chapter_number, phase=phase)

    if used_titles is None:
        return title

    if title not in used_titles:
        used_titles.add(title)
        return title

    for candidate in _build_alternative_title_candidates(goal):
        normalized_candidate = _normalize_title_base(candidate)
        if len(normalized_candidate) > 16:
            normalized_candidate = normalized_candidate[:16].rstrip("，。！？；：:、-—_·. ")
        if not normalized_candidate or _is_bad_title(normalized_candidate):
            continue
        if normalized_candidate in used_titles:
            continue
        used_titles.add(normalized_candidate)
        return normalized_candidate

    for offset in range(0, 120):
        candidate = _derive_fallback_title_by_index(chapter_number + offset)
        normalized_candidate = _normalize_title_base(candidate)
        if not normalized_candidate or _is_bad_title(normalized_candidate):
            continue
        if normalized_candidate in used_titles:
            continue
        used_titles.add(normalized_candidate)
        return normalized_candidate

    emergency = f"章节{max(chapter_number, 1)}备选"
    used_titles.add(emergency)
    return emergency


def normalize_outline_items(
    *,
    outline: List[Dict[str, str]],
    prompt: str,
    chapter_count: int,
    start_chapter_number: int = 1,
    continuation_mode: bool = False,
    existing_titles: Optional[Iterable[str]] = None,
) -> List[Dict[str, str]]:
    phase_hints = build_outline_phase_hints(chapter_count, continuation_mode)
    used_titles: Set[str] = set()
    if existing_titles:
        for item in existing_titles:
            normalized_title = _normalize_title_base(str(item or ""))
            if not normalized_title:
                continue
            used_titles.add(normalized_title)
            shortened = normalized_title[:16].rstrip("，。！？；：:、-—_·. ")
            if shortened:
                used_titles.add(shortened)
    normalized_items: List[Dict[str, str]] = []

    for idx in range(chapter_count):
        chapter_no = start_chapter_number + idx
        phase_info = (
            phase_hints[idx] if idx < len(phase_hints) else {"phase": "推进", "focus": "推进主线"}
        )

        source = outline[idx] if idx < len(outline) else {}
        raw_goal = str((source or {}).get("goal", "")).strip()
        goal = raw_goal if raw_goal else f"围绕“{prompt}”推进：{phase_info['focus']}"
        goal = goal[:240]

        title = normalize_chapter_title(
            raw_title=str((source or {}).get("title", "")),
            goal=goal,
            chapter_number=chapter_no,
            used_titles=used_titles,
            phase=phase_info.get("phase"),
        )

        normalized_items.append({"title": title, "goal": goal})

    return normalized_items


def strip_leading_chapter_heading(text: str) -> str:
    content = (text or "").strip()
    if not content:
        return ""

    lines = content.splitlines()
    while lines and not lines[0].strip():
        lines.pop(0)
    if not lines:
        return ""

    first = lines[0].strip()
    if first.startswith("#"):
        heading = re.sub(r"^#+\s*", "", first).strip()
        if heading and (heading.startswith("第") or heading.lower().startswith("chapter")):
            lines = lines[1:]
    elif _CHAPTER_PREFIX_CN_RE.match(first) or _CHAPTER_PREFIX_EN_RE.match(first):
        lines = lines[1:]

    return "\n".join(lines).strip()


def build_locked_facts(
    *,
    entities: List["EntityState"],
    events: List["EventEdge"],
    conflicts: List["Conflict"],
    current_chapter: int,
) -> List[str]:
    """Extract immutable facts from structured entity/event/conflict data.

    These facts represent constraints that generation MUST NOT violate:
    - Dead or permanently removed characters
    - Entity-level persistent constraints
    - High-confidence irreversible events
    - Unresolved P0 conflicts
    """
    facts: List[str] = []

    _DEAD_STATUSES = frozenset({"dead", "deceased", "eliminated", "死亡", "已死"})
    _UNAVAILABLE_STATUSES = frozenset({"missing", "absent", "sealed", "失踪", "封印"})
    _IRREVERSIBLE_KEYWORDS = frozenset({"death", "死亡", "消亡", "毁灭", "永久", "不可逆"})

    for entity in entities:
        status_value = entity.attrs.get("status")
        if status_value in (None, ""):
            status_value = entity.attrs.get("状态", "")
        status = str(status_value or "").strip().lower()
        if status in _DEAD_STATUSES:
            facts.append(
                f"【角色已死亡】{entity.name}（第{entity.last_seen_chapter}章），不得复活或出场"
            )
        elif status in _UNAVAILABLE_STATUSES:
            facts.append(
                f"【角色不可用】{entity.name} 当前状态「{status}」，不得正常出场"
            )
        for constraint in entity.constraints:
            if constraint.strip():
                facts.append(f"【{entity.name}·约束】{constraint}")

    for event in events:
        if event.chapter < current_chapter and event.confidence >= 0.9:
            if any(kw in (event.relation or "") for kw in _IRREVERSIBLE_KEYWORDS):
                desc = event.description or event.relation
                facts.append(f"【不可逆事件·第{event.chapter}章】{desc}")

    for conflict in conflicts:
        if (
            conflict.severity.value == "P0"
            and not conflict.resolved
            and not conflict.exempted
        ):
            facts.append(f"【P0约束】{conflict.reason}")

    return facts


def build_setter_constraints(
    *,
    entities: List["EntityState"],
    events: List["EventEdge"],
    chapter_number: int,
    beats: List[str],
    window: int = 3,
) -> List[str]:
    """Extract constraints relevant to the current chapter's beats.

    Surfaces only the entity states and recent events that are active
    within the rolling window, keeping prompt size bounded.
    """
    constraints: List[str] = []

    _STATE_KEYS = frozenset({
        "status", "location", "condition", "ability", "mood",
        "位置", "状态", "伤势", "能力",
    })
    beats_text = "\n".join(
        str(beat or "").strip() for beat in beats if str(beat or "").strip()
    )

    def _matches_beats(*values: object) -> bool:
        if not beats_text:
            return True
        for value in values:
            candidate = str(value or "").strip()
            if candidate and candidate in beats_text:
                return True
        return False

    active_entities = [
        e for e in entities
        if e.last_seen_chapter >= chapter_number - window or e.constraints
    ]
    if beats_text:
        active_entities = [
            entity
            for entity in active_entities
            if _matches_beats(entity.name, *entity.attrs.values(), *entity.constraints)
        ]
    active_entities = active_entities[:5]

    for entity in active_entities:
        state_parts = [
            f"{k}={v}" for k, v in entity.attrs.items()
            if k in _STATE_KEYS and v
        ]
        if state_parts:
            constraints.append(
                f"【{entity.name}·当前状态】{'，'.join(state_parts)}"
            )

    recent_events = [
        e for e in events
        if chapter_number - window <= e.chapter < chapter_number
    ]
    if beats_text:
        recent_events = [
            event
            for event in recent_events
            if _matches_beats(
                event.subject,
                event.relation,
                event.object,
                event.description,
            )
        ]
    for event in recent_events[-10:]:
        parts = [event.subject, event.relation]
        if event.object:
            parts.append(event.object)
        summary = "".join(parts)
        if event.description:
            summary += f"：{event.description}"
        constraints.append(f"【近期事件·第{event.chapter}章】{summary}")

    return constraints


def collapse_blank_lines(text: str, max_consecutive_blank: int = 1) -> str:
    content = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    if max_consecutive_blank < 1:
        max_consecutive_blank = 1

    out: List[str] = []
    blank_count = 0
    for line in content.split("\n"):
        if line.strip() == "":
            blank_count += 1
            if blank_count <= max_consecutive_blank:
                out.append("")
        else:
            blank_count = 0
            out.append(line.rstrip())
    return "\n".join(out).strip()
