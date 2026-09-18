import json
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any


def _safe_json_loads(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}

    try:
        value = json.loads(raw)
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}

    return value if isinstance(value, dict) else {"value": value}


def _serialize_detail(detail: dict[str, Any] | None) -> str:
    return json.dumps(detail or {}, ensure_ascii=False)


def _row_to_learning_result(row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "module_key": row["module_key"],
        "activity_key": row["activity_key"],
        "title": row["title"],
        "score": float(row["score"] or 0),
        "max_score": float(row["max_score"] or 0),
        "accuracy": float(row["accuracy"]) if row.get("accuracy") is not None else None,
        "time_spent_seconds": int(row["time_spent_seconds"] or 0),
        "detail": _safe_json_loads(row.get("detail_json")),
        "created_at": row["created_at"],
    }


def _row_to_document_summary(row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "source_name": row.get("source_name") or "",
        "source_type": row["source_type"],
        "original_text": row["original_text"],
        "summary_text": row["summary_text"],
        "sentence_count": int(row["sentence_count"] or 0),
        "original_length": int(row["original_length"] or 0),
        "summary_length": int(row["summary_length"] or 0),
        "created_at": row["created_at"],
    }


def record_learning_result(
    conn,
    user_id: int,
    *,
    module_key: str,
    activity_key: str,
    title: str,
    score: float = 0,
    max_score: float = 100,
    accuracy: float | None = None,
    time_spent_seconds: int = 0,
    detail: dict[str, Any] | None = None,
):
    row = conn.execute(
        """
        INSERT INTO learning_results (
            user_id,
            module_key,
            activity_key,
            title,
            score,
            max_score,
            accuracy,
            time_spent_seconds,
            detail_json
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            user_id,
            module_key,
            activity_key,
            title,
            score,
            max_score,
            accuracy,
            time_spent_seconds,
            _serialize_detail(detail),
        ),
    ).fetchone()
    return _row_to_learning_result(row)


def record_document_summary(
    conn,
    user_id: int,
    *,
    source_name: str | None,
    source_type: str,
    original_text: str,
    summary_text: str,
    sentence_count: int,
    original_length: int,
    summary_length: int,
):
    row = conn.execute(
        """
        INSERT INTO document_summaries (
            user_id,
            source_name,
            source_type,
            original_text,
            summary_text,
            sentence_count,
            original_length,
            summary_length
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            user_id,
            source_name,
            source_type,
            original_text,
            summary_text,
            sentence_count,
            original_length,
            summary_length,
        ),
    ).fetchone()
    return _row_to_document_summary(row)


def list_learning_results(conn, user_id: int, limit: int = 20, module_key: str | None = None):
    params: list[Any] = [user_id]
    sql = """
        SELECT *
        FROM learning_results
        WHERE user_id = %s
    """
    if module_key:
        sql += " AND module_key = %s"
        params.append(module_key)

    sql += " ORDER BY created_at DESC LIMIT %s"
    params.append(limit)

    rows = conn.execute(sql, tuple(params)).fetchall()
    return [_row_to_learning_result(row) for row in rows]


def list_document_summaries(conn, user_id: int, limit: int = 20):
    rows = conn.execute(
        """
        SELECT *
        FROM document_summaries
        WHERE user_id = %s
        ORDER BY created_at DESC
        LIMIT %s
        """,
        (user_id, limit),
    ).fetchall()
    return [_row_to_document_summary(row) for row in rows]


def get_learning_overview(conn, user_id: int):
    stats = conn.execute(
        """
        SELECT
            COUNT(*)::int AS total_results,
            COALESCE(SUM(score), 0) AS total_score,
            COALESCE(AVG(score), 0) AS average_score,
            COALESCE(MAX(score), 0) AS best_score,
            COALESCE(AVG(accuracy), 0) AS average_accuracy,
            COALESCE(SUM(time_spent_seconds), 0) AS total_time_spent,
            COUNT(DISTINCT module_key)::int AS module_count
        FROM learning_results
        WHERE user_id = %s
        """,
        (user_id,),
    ).fetchone()

    module_rows = conn.execute(
        """
        SELECT
            module_key,
            COUNT(*)::int AS attempts,
            COALESCE(AVG(score), 0) AS average_score,
            COALESCE(MAX(score), 0) AS best_score,
            COALESCE(AVG(accuracy), 0) AS average_accuracy,
            COALESCE(SUM(time_spent_seconds), 0) AS total_time_spent
        FROM learning_results
        WHERE user_id = %s
        GROUP BY module_key
        ORDER BY MAX(created_at) DESC
        """,
        (user_id,),
    ).fetchall()

    return {
        "summary": {
            "total_results": int(stats["total_results"] or 0),
            "total_score": float(stats["total_score"] or 0),
            "average_score": float(stats["average_score"] or 0),
            "best_score": float(stats["best_score"] or 0),
            "average_accuracy": float(stats["average_accuracy"] or 0),
            "total_time_spent": int(stats["total_time_spent"] or 0),
            "module_count": int(stats["module_count"] or 0),
        },
        "module_breakdown": [
            {
                "module_key": row["module_key"],
                "attempts": int(row["attempts"] or 0),
                "average_score": float(row["average_score"] or 0),
                "best_score": float(row["best_score"] or 0),
                "average_accuracy": float(row["average_accuracy"] or 0),
                "total_time_spent": int(row["total_time_spent"] or 0),
            }
            for row in module_rows
        ],
    }


SKILL_FIELDS = (
    "alphabet_score",
    "number_score",
    "geometry_score",
    "math_score",
    "reading_score",
    "time_score",
)

SKILL_LABELS = {
    "alphabet_score": "Bảng chữ cái",
    "number_score": "Học số",
    "geometry_score": "Hình học",
    "math_score": "Phép toán",
    "reading_score": "Luyện đọc",
    "time_score": "Học giờ",
}

SKILL_WEIGHTS = {
    "alphabet_score": 0.30,
    "number_score": 0.20,
    "geometry_score": 0.20,
    "reading_score": 0.15,
    "time_score": 0.15,
}


def _normalize_text(value: Any) -> str:
    return str(value or "").strip().lower()


def _normalize_score(row) -> float:
    score = float(row.get("score") or 0)
    max_score = float(row.get("max_score") or 100)
    accuracy = row.get("accuracy")

    normalized = score
    if max_score > 0:
        normalized = (score / max_score) * 100
    if accuracy is not None and normalized <= 0:
        normalized = float(accuracy)

    return max(0.0, min(100.0, round(normalized, 2)))


def _week_start(value: datetime) -> date:
    date_value = value.date() if isinstance(value, datetime) else value
    return date_value - timedelta(days=date_value.weekday())


def _format_week_range(week_start) -> str:
    week_end = week_start + timedelta(days=6)
    return f"{week_start.strftime('%d/%m')} - {week_end.strftime('%d/%m')}"


def _row_skill_key(row) -> str | None:
    module_key = _normalize_text(row.get("module_key"))
    activity_key = _normalize_text(row.get("activity_key"))
    title = _normalize_text(row.get("title"))
    detail = _safe_json_loads(row.get("detail_json"))
    source_type = _normalize_text(detail.get("source_type"))

    if module_key in {"letters", "alphabet"} or "chu" in title or "letter" in activity_key:
        return "alphabet_score"

    if module_key in {"shapes", "geometry"} or "shape" in activity_key or "hinh" in title:
        return "geometry_score"

    if module_key in {"reading", "stt"} or "read" in activity_key or "speech" in activity_key:
        return "reading_score"

    if module_key == "document" or activity_key.startswith("ocr") or source_type == "ocr":
        return "reading_score"

    if module_key in {"time", "clock"} or "time" in activity_key or "clock" in activity_key or "gio" in title:
        return "time_score"

    if module_key in {"math"}:
        return "math_score"

    if module_key in {"numbers", "number"}:
        math_markers = ("math", "finger", "camera", "solve", "addition", "subtraction")
        if any(marker in activity_key for marker in math_markers) or any(symbol in title for symbol in ("+", "-", "=", "x", "÷")):
            return "math_score"
        return "number_score"

    if "math" in activity_key:
        return "math_score"

    return None


# Cac mode noi ro ket qua KHONG den tu camera (Muc 5.4 - sua du lieu P0).
NON_CAMERA_MODES = {"tap", "compose", "guess", "manual", "keyboard"}


def _is_camera_result(row) -> bool:
    module_key = _normalize_text(row.get("module_key"))
    activity_key = _normalize_text(row.get("activity_key"))
    detail = _safe_json_loads(row.get("detail_json"))
    mode = _normalize_text(detail.get("mode"))

    if "camera" in activity_key or "camera" in mode:
        return True

    # Ban ghi noi ro cach tra loi thi tin theo no. Truoc day moi ket qua cua
    # mon Toan / Hinh deu bi tinh la camera, ke ca khi be chi bam nut, nen huy
    # hieu camera mo nham va bao cao hien "Ket qua AI camera" cho ca be chua
    # tung bat camera.
    if mode in NON_CAMERA_MODES or activity_key.startswith("tap_"):
        return False

    return module_key in {"geometry", "math"} and activity_key not in {"speech_evaluation", "ocr_summary"}


def _build_summary_from_rows(rows: list[dict[str, Any]]) -> dict[str, Any]:
    if not rows:
        return {
            "total_results": 0,
            "total_score": 0.0,
            "average_score": 0.0,
            "best_score": 0.0,
            "average_accuracy": 0.0,
            "total_time_spent": 0,
            "module_count": 0,
            "active_days": 0,
            "current_streak_days": 0,
            "best_streak_days": 0,
            "latest_activity_at": None,
        }

    total_score = 0.0
    total_accuracy = 0.0
    accuracy_count = 0
    total_time_spent = 0
    best_score = 0.0
    modules = set()
    activity_days: set[Any] = set()
    dates_sorted: list[Any] = []

    for row in rows:
        score = _normalize_score(row)
        total_score += score
        best_score = max(best_score, score)
        if row.get("accuracy") is not None:
            total_accuracy += float(row["accuracy"])
            accuracy_count += 1
        total_time_spent += int(row.get("time_spent_seconds") or 0)
        module_key = _normalize_text(row.get("module_key"))
        if module_key:
            modules.add(module_key)
        created_at = row.get("created_at")
        if created_at is not None:
            activity_days.add(created_at.date())
            dates_sorted.append(created_at.date())

    latest_activity = max(dates_sorted) if dates_sorted else None
    current_streak = 0
    best_streak = 0
    if dates_sorted:
        unique_days = sorted(set(dates_sorted))

        current_streak = 1
        for index in range(len(unique_days) - 1, 0, -1):
            if (unique_days[index] - unique_days[index - 1]).days == 1:
                current_streak += 1
            else:
                break

        best_streak = 1
        running_streak = 1
        for index in range(1, len(unique_days)):
            if (unique_days[index] - unique_days[index - 1]).days == 1:
                running_streak += 1
            else:
                best_streak = max(best_streak, running_streak)
                running_streak = 1
        best_streak = max(best_streak, running_streak)

        if latest_activity != datetime.now(timezone.utc).date():
            current_streak = 0

    return {
        "total_results": len(rows),
        "total_score": round(total_score, 2),
        "average_score": round(total_score / len(rows), 2),
        "best_score": round(best_score, 2),
        "average_accuracy": round(total_accuracy / accuracy_count, 2) if accuracy_count else 0.0,
        "total_time_spent": total_time_spent,
        "module_count": len(modules),
        "active_days": len(activity_days),
        "current_streak_days": current_streak,
        "best_streak_days": best_streak,
        "latest_activity_at": latest_activity,
    }


def _build_module_breakdown(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "attempts": 0,
            "score_total": 0.0,
            "best_score": 0.0,
            "accuracy_total": 0.0,
            "accuracy_count": 0,
            "time_spent_seconds": 0,
            "latest_at": None,
        }
    )

    for row in rows:
        module_key = _normalize_text(row.get("module_key")) or "unknown"
        score = _normalize_score(row)
        created_at = row.get("created_at")
        group = groups[module_key]
        group["attempts"] += 1
        group["score_total"] += score
        group["best_score"] = max(group["best_score"], score)
        group["time_spent_seconds"] += int(row.get("time_spent_seconds") or 0)
        if row.get("accuracy") is not None:
            group["accuracy_total"] += float(row["accuracy"])
            group["accuracy_count"] += 1
        if created_at is not None and (group["latest_at"] is None or created_at > group["latest_at"]):
            group["latest_at"] = created_at

    module_rows = []
    for module_key, group in groups.items():
        attempts = group["attempts"]
        module_rows.append(
            {
                "module_key": module_key,
                "attempts": attempts,
                "average_score": round(group["score_total"] / attempts, 2) if attempts else 0.0,
                "best_score": round(group["best_score"], 2),
                "average_accuracy": round(group["accuracy_total"] / group["accuracy_count"], 2)
                if group["accuracy_count"]
                else 0.0,
                "total_time_spent": int(group["time_spent_seconds"]),
                "latest_at": group["latest_at"],
            }
        )

    module_rows.sort(key=lambda item: item["latest_at"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return module_rows


def _upsert_skill_statistics(conn, user_id: int, rows: list[dict[str, Any]]):
    aggregates = {
        field: {"total": 0.0, "attempts": 0, "best": 0.0}
        for field in SKILL_FIELDS
    }

    for row in rows:
        skill_key = _row_skill_key(row)
        if not skill_key:
            continue
        score = _normalize_score(row)
        aggregates[skill_key]["total"] += score
        aggregates[skill_key]["attempts"] += 1
        aggregates[skill_key]["best"] = max(aggregates[skill_key]["best"], score)

    scores = {
        field: round(value["total"] / value["attempts"], 2) if value["attempts"] else 0.0
        for field, value in aggregates.items()
    }

    conn.execute(
        """
        INSERT INTO skill_statistics (
            user_id,
            alphabet_score,
            number_score,
            geometry_score,
            math_score,
            reading_score,
            time_score,
            updated_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
            alphabet_score = EXCLUDED.alphabet_score,
            number_score = EXCLUDED.number_score,
            geometry_score = EXCLUDED.geometry_score,
            math_score = EXCLUDED.math_score,
            reading_score = EXCLUDED.reading_score,
            time_score = EXCLUDED.time_score,
            updated_at = NOW()
        """,
        (
            user_id,
            scores["alphabet_score"],
            scores["number_score"],
            scores["geometry_score"],
            scores["math_score"],
            scores["reading_score"],
            scores["time_score"],
        ),
    )

    return {
        "scores": scores,
        "attempts": {field: value["attempts"] for field, value in aggregates.items()},
        "best": {field: round(value["best"], 2) for field, value in aggregates.items()},
    }


def _build_weekly_trend(rows: list[dict[str, Any]], week_count: int = 4):
    if not rows:
        return []

    latest_day = max(row["created_at"].date() for row in rows if row.get("created_at"))
    current_week_start = latest_day - timedelta(days=latest_day.weekday())
    week_starts = [current_week_start - timedelta(weeks=index) for index in range(week_count - 1, -1, -1)]

    trend = []
    for index, week_start in enumerate(week_starts, start=1):
        week_end = week_start + timedelta(days=6)
        week_scores = [
            _normalize_score(row)
            for row in rows
            if row.get("created_at") and week_start <= row["created_at"].date() <= week_end
        ]
        average_score = round(sum(week_scores) / len(week_scores), 2) if week_scores else 0.0
        trend.append(
            {
                "label": f"Tuần {index}",
                "range_label": _format_week_range(week_start),
                "score": average_score,
                "attempts": len(week_scores),
            }
        )

    return trend


def _build_ali(skill_snapshot: dict[str, Any]) -> dict[str, Any]:
    scores = skill_snapshot["scores"]
    attempts = skill_snapshot["attempts"]
    components = []
    weighted_total = 0.0
    total_weight = 0.0

    for field, weight in SKILL_WEIGHTS.items():
        score = scores.get(field, 0.0)
        attempts_count = attempts.get(field, 0)
        if attempts_count:
            weighted_total += score * weight
            total_weight += weight
        components.append(
            {
                "key": field,
                "label": SKILL_LABELS[field],
                "score": round(score, 2),
                "weight": round(weight * 100),
                "attempts": attempts_count,
            }
        )

    ali_score = round(weighted_total / total_weight, 2) if total_weight else 0.0
    if ali_score >= 90:
        ali_label = "Xuất sắc"
    elif ali_score >= 80:
        ali_label = "Tốt"
    elif ali_score >= 70:
        ali_label = "Khá"
    else:
        ali_label = "Cần cố gắng"

    note_parts = []
    for field in ("alphabet_score", "number_score", "geometry_score", "reading_score"):
        if scores.get(field, 0) >= 85:
            note_parts.append(SKILL_LABELS[field].lower())
    if not note_parts:
        note = "Các kỹ năng đang ở giai đoạn khởi động, cần thêm vài buổi học để nhìn rõ xu hướng."
    else:
        note = f"Điểm mạnh hiện tại của bé nằm ở {', '.join(note_parts[:3])}."

    if attempts.get("time_score", 0) == 0:
        note += " Học giờ chưa có dữ liệu nên chỉ số học tập chưa phản ánh đầy đủ."

    return {
        "score": ali_score,
        "label": ali_label,
        "note": note,
        "components": components,
    }


def _build_skill_cards(skill_snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    scores = skill_snapshot["scores"]
    attempts = skill_snapshot["attempts"]
    cards = []

    for field in SKILL_FIELDS:
        score = round(scores.get(field, 0.0), 2)
        attempts_count = attempts.get(field, 0)
        if score >= 85:
            tone = "good"
        elif score >= 70:
            tone = "warn"
        else:
            tone = "danger"
        cards.append(
            {
                "key": field,
                "label": SKILL_LABELS[field],
                "score": score,
                "attempts": attempts_count,
                "tone": tone,
                "status": "Xanh" if tone == "good" else "Vàng" if tone == "warn" else "Đỏ",
            }
        )

    return cards


def _build_camera_results(rows: list[dict[str, Any]]) -> dict[str, Any]:
    camera_rows = [row for row in rows if _is_camera_result(row)]
    grouped: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "attempts": 0,
            "score_total": 0.0,
            "best_score": 0.0,
            "latest_at": None,
        }
    )

    for row in camera_rows:
        detail = _safe_json_loads(row.get("detail_json"))
        label = (
            detail.get("target_label")
            or detail.get("label")
            or detail.get("displayLabel")
            or detail.get("prediction_label")
            or row.get("title")
            or "Camera AI"
        )
        score = _normalize_score(row)
        created_at = row.get("created_at")
        group = grouped[label]
        group["attempts"] += 1
        group["score_total"] += score
        group["best_score"] = max(group["best_score"], score)
        if created_at is not None and (group["latest_at"] is None or created_at > group["latest_at"]):
            group["latest_at"] = created_at

    items = []
    for label, group in grouped.items():
        attempts = group["attempts"]
        average_score = round(group["score_total"] / attempts, 2) if attempts else 0.0
        items.append(
            {
                "label": label,
                "score": average_score,
                "attempts": attempts,
                "best_score": round(group["best_score"], 2),
                "status": "Xanh" if average_score >= 85 else "Vàng" if average_score >= 70 else "Đỏ",
                "latest_at": group["latest_at"],
            }
        )

    items.sort(key=lambda item: (item["score"], item["attempts"]), reverse=True)
    top_names = [item["label"] for item in items if item["score"] >= 85][:2]
    weak_names = [item["label"] for item in items if item["score"] < 70][:1]

    if top_names and weak_names:
        insight = f"Bé nhận biết tốt {', '.join(top_names)}. Cần luyện thêm {weak_names[0]}."
    elif top_names:
        insight = f"Bé đang làm tốt {', '.join(top_names)}."
    elif weak_names:
        insight = f"Bé cần luyện thêm {weak_names[0]}."
    else:
        insight = "Chưa có dữ liệu AI camera, hãy thử bài nhận diện hình hoặc phép toán."

    summary = {
        "attempts": len(camera_rows),
        "average_score": round(sum(item["score"] * item["attempts"] for item in items) / len(camera_rows), 2)
        if camera_rows
        else 0.0,
        "best_score": round(max((item["best_score"] for item in items), default=0.0), 2),
    }

    return {
        "summary": summary,
        "items": items[:5],
        "insight": insight,
    }


def _build_reading_results(rows: list[dict[str, Any]], documents: list[dict[str, Any]]) -> dict[str, Any]:
    reading_rows = [row for row in rows if _row_skill_key(row) == "reading_score"]
    if not reading_rows:
        return {
            "summary": {
                "total_words": 0,
                "average_accuracy": 0.0,
                "best_accuracy": 0.0,
                "speed_wpm": 0.0,
                "level": "Chưa có dữ liệu",
            },
            "latest": None,
            "wrong_words": [],
            "wrong_words_detail": [],
            "insight": "Bé chưa có dữ liệu luyện đọc. Hãy thử bài đọc giọng nói hoặc tóm tắt văn bản.",
            "documents": documents[:2],
        }

    accuracy_scores = [_normalize_score(row) for row in reading_rows]
    total_words = 0
    speed_values = []
    wrong_counter: Counter[str] = Counter()
    wrong_details: list[dict[str, Any]] = []

    for row in reading_rows:
        detail = _safe_json_loads(row.get("detail_json"))
        total_words += int(detail.get("total_words") or detail.get("word_count") or 0)
        speed_value = detail.get("words_per_minute") or detail.get("wpm") or detail.get("speed")
        if speed_value is not None:
            try:
                speed_values.append(float(speed_value))
            except (TypeError, ValueError):
                pass

        for wrong in detail.get("wrong_words", []) or []:
            if isinstance(wrong, dict):
                wrong_label = f"{wrong.get('expected', '')} → {wrong.get('got', '')}".strip(" →")
                wrong_details.append(
                    {
                        "expected": wrong.get("expected", ""),
                        "got": wrong.get("got", ""),
                    }
                )
                if wrong.get("expected"):
                    wrong_counter[str(wrong.get("expected"))] += 1
            else:
                wrong_label = str(wrong)
                wrong_counter[wrong_label] += 1

    latest_row = max(reading_rows, key=lambda row: row["created_at"])
    latest_detail = _safe_json_loads(latest_row.get("detail_json"))
    wrong_words = [word for word, _ in wrong_counter.most_common(5)]

    average_accuracy = round(sum(accuracy_scores) / len(accuracy_scores), 2)
    best_accuracy = round(max(accuracy_scores), 2)
    speed_wpm = round(sum(speed_values) / len(speed_values), 2) if speed_values else 0.0

    if average_accuracy >= 90:
        level = "Xuất sắc"
    elif average_accuracy >= 80:
        level = "Khá"
    elif average_accuracy >= 60:
        level = "Cần luyện thêm"
    else:
        level = "Mới bắt đầu"

    if wrong_words:
        insight = f"Bé đang tiến bộ ở mức {level}. Cần chú ý thêm các từ {', '.join(wrong_words[:3])}."
    else:
        insight = f"Bé đang đọc khá ổn. Mức hiện tại: {level}."

    return {
        "summary": {
            "total_words": total_words,
            "average_accuracy": average_accuracy,
            "best_accuracy": best_accuracy,
            "speed_wpm": speed_wpm,
            "level": level,
        },
        "latest": {
            "accuracy": _normalize_score(latest_row),
            "total_words": int(latest_detail.get("total_words") or 0),
            "correct_count": int(latest_detail.get("correct_count") or 0),
            "feedback": latest_detail.get("feedback") or "",
            "created_at": latest_row.get("created_at"),
        },
        "wrong_words": wrong_words,
        "wrong_words_detail": wrong_details[-6:],
        "insight": insight,
        "documents": documents[:2],
    }


# ── Huy hieu (Muc 5.11) ─────────────────────────────────────────────────
# Moi huy hieu co id CO DINH de frontend nho duoc "da xem" qua localStorage.
# kid_name / kid_description la ban danh cho be; name / description giu nguyen
# cho bao cao phu huynh. kid_name rong = khong hien o phong huy hieu cua be.
BADGE_DEFINITIONS = [
    {
        "id": "start",
        "name": "Khởi động",
        "kid_name": "Bắt đầu",
        "icon": "🚀",
        "description": "Đã có ít nhất một hoạt động học tập.",
        "kid_description": "Con đã học bài đầu tiên rồi!",
        "tone": "blue",
        "target": 1,
        "source": "total_results",
    },
    {
        "id": "hardworking",
        "name": "Chăm chỉ",
        "kid_name": "Ong chăm chỉ",
        "icon": "🐝",
        "description": "Hoàn thành từ 10 hoạt động trở lên.",
        "kid_description": "Học đủ 10 bài để nhận huy hiệu Ong chăm chỉ!",
        "tone": "amber",
        "target": 10,
        "source": "total_results",
    },
    {
        "id": "streak3",
        "name": "Bền bỉ",
        "kid_name": "Lửa 3 ngày",
        "icon": "🔥",
        "description": "Duy trì chuỗi học tập từ 3 ngày.",
        "kid_description": "Học 3 ngày liền để nhận huy hiệu Lửa 3 ngày!",
        "tone": "teal",
        "target": 3,
        "source": "streak",
    },
    {
        "id": "streak7",
        "name": "Đều đặn",
        "kid_name": "Cầu vồng 7 ngày",
        "icon": "🌈",
        "description": "Chuỗi học tập từ 7 ngày.",
        "kid_description": "Học 7 ngày liền để nhận huy hiệu Cầu vồng!",
        "tone": "green",
        "target": 7,
        "source": "streak",
    },
    {
        "id": "alphabet",
        "name": "Bảng chữ cái",
        "kid_name": "Vua chữ cái",
        "icon": "🔤",
        "description": "Điểm chữ cái đạt từ 85 trở lên.",
        "kid_description": "Học thật giỏi bảng chữ cái để thành Vua chữ cái!",
        "tone": "coral",
        "target": 85,
        "source": "skill:alphabet_score",
    },
    {
        "id": "numbers",
        "name": "Học số",
        "kid_name": "Bạn của số",
        "icon": "🔢",
        "description": "Điểm số đạt từ 85 trở lên.",
        "kid_description": "Nhận biết số thật giỏi để thành Bạn của số!",
        "tone": "yellow",
        "target": 85,
        "source": "skill:number_score",
    },
    {
        "id": "shapes",
        "name": "Hình học",
        "kid_name": "Thám tử hình",
        "icon": "🔺",
        "description": "Điểm hình học đạt từ 85 trở lên.",
        "kid_description": "Nhận ra thật nhiều hình để thành Thám tử hình!",
        "tone": "blue",
        "target": 85,
        "source": "skill:geometry_score",
    },
    {
        "id": "math",
        "name": "Phép toán",
        "kid_name": "Siêu cộng trừ",
        "icon": "➕",
        "description": "Điểm phép toán đạt từ 85 trở lên.",
        "kid_description": "Làm toán thật giỏi để thành Siêu cộng trừ!",
        "tone": "violet",
        "target": 85,
        "source": "skill:math_score",
    },
    {
        "id": "reading",
        "name": "Luyện đọc",
        "kid_name": "Giọng đọc hay",
        "icon": "📖",
        "description": "Điểm luyện đọc đạt từ 85 trở lên.",
        "kid_description": "Đọc thật rõ ràng để có Giọng đọc hay!",
        "tone": "green",
        "target": 85,
        "source": "skill:reading_score",
    },
    {
        "id": "readaloud",
        "name": "Đọc lên tiếng",
        "kid_name": "Đọc to",
        "icon": "🎤",
        "description": "Đã hoàn thành ít nhất một phiên luyện đọc.",
        "kid_description": "Đọc to một bài cho máy nghe để nhận huy hiệu Đọc to!",
        "tone": "pink",
        "target": 1,
        "source": "reading_words",
    },
    {
        "id": "camera",
        "name": "Mắt camera",
        "kid_name": "Bàn tay thần kì",
        "icon": "🖐️",
        "description": "Đã trả lời bằng camera ít nhất một lần.",
        "kid_description": "Trả lời bằng ngón tay trước camera để nhận Bàn tay thần kì!",
        "tone": "cyan",
        "target": 1,
        "source": "camera_attempts",
    },
    {
        "id": "superstar",
        "name": "Siêu sao AI",
        "kid_name": "Siêu sao",
        "icon": "🌟",
        "description": "Chỉ số học tập từ 85 trở lên.",
        "kid_description": "Học đều tất cả các môn để thành Siêu sao!",
        "tone": "purple",
        "target": 85,
        "source": "ali",
    },
    {
        # Chi hien o bao cao phu huynh: kid_name de rong nen phong huy hieu
        # cua be bo qua the nay (Muc 5.11).
        "id": "smartdoc",
        "name": "Tài liệu thông minh",
        "kid_name": "",
        "icon": "📄",
        "description": "Đã xử lý ít nhất một tài liệu học tập.",
        "kid_description": "",
        "tone": "slate",
        "target": 1,
        "source": "documents",
    },
]


def _badge_progress_value(definition: dict[str, Any], context: dict[str, Any]) -> float:
    source = definition["source"]
    if source.startswith("skill:"):
        return float(context["skill_scores"].get(source.split(":", 1)[1], 0) or 0)
    return float(context.get(source, 0) or 0)


def _badge_context(
    summary: dict[str, Any],
    skill_cards: list[dict[str, Any]],
    ali: dict[str, Any],
    documents: list[dict[str, Any]],
    camera_results: dict[str, Any],
    reading_results: dict[str, Any],
) -> dict[str, Any]:
    return {
        "skill_scores": {item["key"]: item["score"] for item in skill_cards},
        "total_results": summary.get("total_results", 0),
        "streak": summary.get("current_streak_days", 0),
        "ali": ali.get("score", 0),
        "documents": len(documents),
        "camera_attempts": (camera_results.get("summary") or {}).get("attempts", 0),
        "reading_words": (reading_results.get("summary") or {}).get("total_words", 0),
    }


def _build_badge_catalog(
    summary: dict[str, Any],
    skill_cards: list[dict[str, Any]],
    ali: dict[str, Any],
    documents: list[dict[str, Any]],
    camera_results: dict[str, Any],
    reading_results: dict[str, Any],
) -> list[dict[str, Any]]:
    """MOI huy hieu kem trang thai va tien do (Muc 5.11).

    Tien do bi chan tran o moc, de "Lua 3 ngay" hien 3/3 chu khong phai 30/3.
    """
    context = _badge_context(summary, skill_cards, ali, documents, camera_results, reading_results)
    catalog = []

    for definition in BADGE_DEFINITIONS:
        target = definition["target"]
        value = _badge_progress_value(definition, context)
        current = int(min(value, target))
        catalog.append(
            {
                "id": definition["id"],
                "name": definition["name"],
                "kid_name": definition["kid_name"],
                "icon": definition["icon"],
                "description": definition["description"],
                "kid_description": definition["kid_description"],
                "tone": definition["tone"],
                "earned": value >= target,
                "progress": {"current": current, "target": target},
            }
        )

    return catalog


def _build_badges(
    summary: dict[str, Any],
    skill_cards: list[dict[str, Any]],
    ali: dict[str, Any],
    documents: list[dict[str, Any]],
    camera_results: dict[str, Any],
    reading_results: dict[str, Any],
) -> list[dict[str, Any]]:
    """Chi gom huy hieu DA DAT - giu nguyen hinh dang cu cho bao cao phu huynh,
    chi them truong `id` (Muc 5.11)."""
    catalog = _build_badge_catalog(
        summary, skill_cards, ali, documents, camera_results, reading_results
    )
    return [
        {
            "id": item["id"],
            "name": item["name"],
            "description": item["description"],
            "tone": item["tone"],
        }
        for item in catalog
        if item["earned"]
    ]


def _sum_total_stars(rows: list[dict[str, Any]]) -> int:
    """Cong so sao tu detail.stars cua tung luot choi (Muc 5.11).

    Ban ghi hong hoac khong co sao thi bo qua chu khong lam vo bao cao.
    """
    total = 0
    for row in rows:
        detail = _safe_json_loads(row.get("detail_json"))
        stars = detail.get("stars")
        if isinstance(stars, bool):
            continue
        if isinstance(stars, (int, float)):
            total += int(stars)
    return total


def _build_recommendations(
    summary: dict[str, Any],
    skill_cards: list[dict[str, Any]],
    trend: list[dict[str, Any]],
    camera_results: dict[str, Any],
    reading_results: dict[str, Any],
) -> list[dict[str, Any]]:
    recommendations: list[dict[str, Any]] = []
    skill_by_key = {item["key"]: item for item in skill_cards}
    weakest = sorted(skill_cards, key=lambda item: item["score"])[:2]

    if weakest and weakest[0]["score"] < 70:
        recommendations.append(
            {
                "title": f"Luyện thêm {weakest[0]['label'].lower()}",
                "reason": f"Điểm hiện tại chỉ {round(weakest[0]['score'])}/100.",
                "actions": [
                    f"Quay lại phần {weakest[0]['label'].lower()}",
                    "Hoàn thành một phiên ngắn 5 phút",
                ],
            }
        )

    if skill_by_key.get("reading_score", {}).get("score", 0) < 80:
        recommendations.append(
            {
                "title": "Tăng cường luyện đọc",
                "reason": "Mức luyện đọc đang thấp hơn các kỹ năng còn lại.",
                "actions": [
                    "Mở bài Luyện đọc bằng giọng nói",
                    "Dùng tài liệu OCR để con đọc theo đoạn ngắn",
                ],
            }
        )

    if skill_by_key.get("math_score", {}).get("score", 0) < 80:
        recommendations.append(
            {
                "title": "Chuyển sang phép toán đơn giản",
                "reason": "Phép toán với Camera AI vẫn cần thêm luyện tập.",
                "actions": [
                    "Làm các phép cộng trừ phạm vi 10",
                    "Chỉ tăng độ khó khi bé trả lời ổn định",
                ],
            }
        )

    if trend:
        latest_score = trend[-1]["score"]
        previous_score = trend[-2]["score"] if len(trend) > 1 else latest_score
        if latest_score < previous_score - 5:
            recommendations.append(
                {
                    "title": "Giữ nhịp học đều",
                    "reason": "Tuần gần nhất giảm nhịp so với tuần trước.",
                    "actions": [
                        "Giữ lịch học cố định mỗi ngày",
                        "Chọn một bài dễ để lấy lại nhịp",
                    ],
                }
            )

    if camera_results["summary"]["attempts"] == 0:
        recommendations.append(
            {
                "title": "Thử AI camera",
                "reason": "Chưa có dữ liệu nhận diện camera để đánh giá.",
                "actions": [
                    "Mở bài Học hình",
                    "Thử lại phần phép toán bằng camera",
                ],
            }
        )

    if not recommendations:
        recommendations.append(
            {
                "title": "Duy trì tốc độ hiện tại",
                "reason": "Các kỹ năng đang khá cân bằng.",
                "actions": [
                    "Tiếp tục học 10 phút mỗi ngày",
                    "Xen kẽ giữa chữ, số, hình và đọc",
                ],
            }
        )

    return recommendations[:4]


def _build_document_comparison(documents: list[dict[str, Any]]) -> dict[str, Any]:
    current = documents[0] if documents else None
    previous = documents[1] if len(documents) > 1 else None
    return {
        "current": current,
        "previous": previous,
    }


def get_learning_dashboard(
    conn,
    user_id: int,
    *,
    user_name: str = "",
    limit: int = 12,
    document_limit: int = 4,
    week_count: int = 4,
):
    rows = conn.execute(
        """
        SELECT *
        FROM learning_results
        WHERE user_id = %s
        ORDER BY created_at ASC
        """,
        (user_id,),
    ).fetchall()

    documents = list_document_summaries(conn, user_id, limit=document_limit)
    summary = _build_summary_from_rows(rows)
    module_breakdown = _build_module_breakdown(rows)
    skill_snapshot = _upsert_skill_statistics(conn, user_id, rows)
    trend = _build_weekly_trend(rows, week_count=week_count)
    skill_cards = _build_skill_cards(skill_snapshot)
    ali = _build_ali(skill_snapshot)
    camera_results = _build_camera_results(rows)
    reading_results = _build_reading_results(rows, documents)
    badges = _build_badges(summary, skill_cards, ali, documents, camera_results, reading_results)
    badge_catalog = _build_badge_catalog(
        summary, skill_cards, ali, documents, camera_results, reading_results
    )
    total_stars = _sum_total_stars(rows)
    recommendations = _build_recommendations(summary, skill_cards, trend, camera_results, reading_results)
    recent_results = list_learning_results(conn, user_id, limit=limit)

    summary_with_badges = {
        **summary,
        "streak_days": summary["current_streak_days"],
        "badges_count": len(badges),
        # Muc 5.11: tong sao gom tu detail.stars cua tung luot 5 cau.
        "total_stars": total_stars,
        "ali_score": ali["score"],
        "ali_label": ali["label"],
    }

    return {
        "profile": {
            "name": user_name,
            "average_score": summary_with_badges["average_score"],
            "current_streak_days": summary_with_badges["current_streak_days"],
            "completed_lessons": summary_with_badges["total_results"],
            "badges_count": summary_with_badges["badges_count"],
            "ali_score": ali["score"],
            "ali_label": ali["label"],
        },
        "summary": summary_with_badges,
        "module_breakdown": module_breakdown,
        "skill_statistics": skill_cards,
        "ali": ali,
        "trend": trend,
        "weekly_report": trend,
        "camera_results": camera_results,
        "reading_results": reading_results,
        "badges": badges,
        # Muc 5.11: MOI huy hieu kem trang thai, cho phong huy hieu cua be.
        # Truong "badges" o tren giu nguyen (chi huy hieu da dat) de trang bao
        # cao phu huynh hien tai khong bi vo.
        "badge_catalog": badge_catalog,
        "recommendations": recommendations,
        "recent_results": recent_results,

    }
