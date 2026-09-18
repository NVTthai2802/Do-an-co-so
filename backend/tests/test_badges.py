# -*- coding: utf-8 -*-
"""
Kiem thu huy hieu va badge_catalog (Muc 5.11).

KHONG dung database. Moi du lieu vao deu la dict gia dung trong bo nho, vi
cac ham duoi day chi nhan dict/list chu khong cham toi ket noi nao.
"""
import sys
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services import learning_results as lr  # noqa: E402


# ───────────────────────── du lieu gia ─────────────────────────

def make_summary(total_results=0, streak=0, total_stars=0):
    return {
        "total_results": total_results,
        "total_score": 0.0,
        "average_score": 0.0,
        "best_score": 0.0,
        "average_accuracy": 0.0,
        "total_time_spent": 0,
        "module_count": 0,
        "current_streak_days": streak,
        "best_streak_days": streak,
        "total_stars": total_stars,
    }


def make_skill_cards(**scores):
    """Moi ky nang mac dinh 0 diem / 0 lan luyen; truyen ten de dat diem."""
    keys = [
        "alphabet_score",
        "number_score",
        "geometry_score",
        "math_score",
        "reading_score",
        "time_score",
    ]
    cards = []
    for key in keys:
        score = float(scores.get(key, 0))
        cards.append(
            {
                "key": key,
                "label": key,
                "score": score,
                "attempts": 1 if score else 0,
            }
        )
    return cards


def make_camera(attempts=0):
    return {"summary": {"attempts": attempts}, "items": [], "insight": ""}


def make_reading(total_words=0):
    return {"summary": {"total_words": total_words}, "items": [], "insight": ""}


def build(summary=None, skills=None, ali_score=0.0, documents=None,
          camera_attempts=0, reading_words=0):
    summary = summary or make_summary()
    skills = skills if skills is not None else make_skill_cards()
    return {
        "summary": summary,
        "skill_cards": skills,
        "ali": {"score": ali_score, "label": "x", "note": "", "components": []},
        "documents": documents or [],
        "camera_results": make_camera(camera_attempts),
        "reading_results": make_reading(reading_words),
    }


def badges_of(args):
    return lr._build_badges(
        args["summary"], args["skill_cards"], args["ali"],
        args["documents"], args["camera_results"], args["reading_results"],
    )


def catalog_of(args):
    return lr._build_badge_catalog(
        args["summary"], args["skill_cards"], args["ali"],
        args["documents"], args["camera_results"], args["reading_results"],
    )


def by_id(catalog):
    return {item["id"]: item for item in catalog}


# ───────────────────── ca 1: tai khoan moi ─────────────────────

def test_tai_khoan_moi_khong_dat_huy_hieu_nao():
    earned = badges_of(build())
    assert earned == []


def test_tai_khoan_moi_van_thay_du_bo_suu_tap():
    catalog = catalog_of(build())
    # Muc 5.11: be nhin thay MOI huy hieu, hau het o trang thai khoa.
    assert len(catalog) == len(lr.BADGE_DEFINITIONS)
    assert all(item["earned"] is False for item in catalog)


def test_moi_huy_hieu_co_du_truong_theo_muc_5_11():
    required = {"id", "name", "kid_name", "icon", "description",
                "kid_description", "tone", "earned", "progress"}
    for item in catalog_of(build()):
        assert required <= set(item), f"thieu truong o huy hieu {item.get('id')}"
        assert set(item["progress"]) == {"current", "target"}
        assert item["progress"]["target"] > 0


def test_id_huy_hieu_la_co_dinh_va_khong_trung():
    ids = [item["id"] for item in catalog_of(build())]
    assert len(ids) == len(set(ids)), "id huy hieu bi trung"
    assert "streak3" in ids and "camera" in ids and "superstar" in ids


def test_phong_huy_hieu_cua_be_co_dung_12_the():
    """Nghiem thu Giai doan 6: tai khoan moi thay du 12 huy hieu."""
    kid = [item for item in catalog_of(build()) if item["kid_name"]]
    assert len(kid) == 12


def test_tai_lieu_thong_minh_khong_hien_o_trang_cua_be():
    """Muc 5.11: 'Tai lieu thong minh' chi danh cho bao cao phu huynh."""
    smartdoc = by_id(catalog_of(build()))["smartdoc"]
    assert not smartdoc["kid_name"]


# ───────────────────── ca 2: chuoi 3 ngay ─────────────────────

def test_chuoi_3_ngay_mo_huy_hieu_lua_3_ngay():
    args = build(summary=make_summary(total_results=3, streak=3))
    catalog = by_id(catalog_of(args))
    assert catalog["streak3"]["earned"] is True
    assert catalog["streak3"]["kid_name"] == "Lửa 3 ngày"
    # Chuoi 7 ngay van con khoa, va tien do phai noi that: 3/7
    assert catalog["streak7"]["earned"] is False
    assert catalog["streak7"]["progress"] == {"current": 3, "target": 7}


def test_chuoi_2_ngay_chua_du_nhung_tien_do_van_dung():
    args = build(summary=make_summary(total_results=2, streak=2))
    catalog = by_id(catalog_of(args))
    assert catalog["streak3"]["earned"] is False
    assert catalog["streak3"]["progress"] == {"current": 2, "target": 3}


def test_chuoi_7_ngay_mo_ca_hai_huy_hieu_chuoi():
    args = build(summary=make_summary(total_results=9, streak=7))
    catalog = by_id(catalog_of(args))
    assert catalog["streak3"]["earned"] is True
    assert catalog["streak7"]["earned"] is True


def test_tien_do_khong_vuot_qua_moc():
    """Chuoi 30 ngay thi 'Lua 3 ngay' van hien 3/3, khong phai 30/3."""
    args = build(summary=make_summary(total_results=40, streak=30))
    catalog = by_id(catalog_of(args))
    assert catalog["streak3"]["progress"] == {"current": 3, "target": 3}
    assert catalog["hardworking"]["progress"] == {"current": 10, "target": 10}


# ──────────────────── ca 3: diem tu 85 tro len ────────────────────

@pytest.mark.parametrize(
    "skill_key,badge_id",
    [
        ("alphabet_score", "alphabet"),
        ("number_score", "numbers"),
        ("geometry_score", "shapes"),
        ("math_score", "math"),
        ("reading_score", "reading"),
    ],
)
def test_diem_85_mo_dung_huy_hieu_cua_mon_do(skill_key, badge_id):
    args = build(summary=make_summary(total_results=5, streak=1),
                 skills=make_skill_cards(**{skill_key: 85}))
    catalog = by_id(catalog_of(args))
    assert catalog[badge_id]["earned"] is True
    # Cac mon khac khong duoc an theo
    others = {"alphabet", "numbers", "shapes", "math", "reading"} - {badge_id}
    assert all(catalog[other]["earned"] is False for other in others)


def test_diem_84_chua_du_85():
    """Moc phai la >= 85, khong duoc lam tron len."""
    args = build(skills=make_skill_cards(alphabet_score=84.9))
    catalog = by_id(catalog_of(args))
    assert catalog["alphabet"]["earned"] is False
    assert catalog["alphabet"]["progress"]["current"] == 84


def test_chi_so_hoc_tap_85_mo_huy_hieu_sieu_sao():
    args = build(summary=make_summary(total_results=12, streak=2), ali_score=85)
    catalog = by_id(catalog_of(args))
    assert catalog["superstar"]["earned"] is True
    assert catalog["superstar"]["kid_name"] == "Siêu sao"


# ─────────────── ca 4: co / khong dung camera ───────────────

def test_khong_dung_camera_thi_huy_hieu_camera_van_khoa():
    args = build(summary=make_summary(total_results=8, streak=1), camera_attempts=0)
    catalog = by_id(catalog_of(args))
    assert catalog["camera"]["earned"] is False
    assert catalog["camera"]["progress"] == {"current": 0, "target": 1}


def test_co_dung_camera_thi_mo_huy_hieu_ban_tay_than_ki():
    args = build(summary=make_summary(total_results=8, streak=1), camera_attempts=4)
    catalog = by_id(catalog_of(args))
    assert catalog["camera"]["earned"] is True
    assert catalog["camera"]["kid_name"] == "Bàn tay thần kì"


def test_be_bam_nut_khong_duoc_tinh_la_dung_camera():
    """
    Muc 5.11 + 5.4: huy hieu camera chi mo khi dap an that su den tu camera.
    Be bam nut thi ghi mode 'tap' va activity_key 'tap_math_10'.
    """
    tap_row = {
        "module_key": "math",
        "activity_key": "tap_math_10",
        "detail_json": '{"mode": "tap", "range_limit": 10}',
    }
    assert lr._is_camera_result(tap_row) is False


def test_dap_an_tu_camera_van_duoc_tinh():
    camera_row = {
        "module_key": "math",
        "activity_key": "camera_math_10",
        "detail_json": '{"mode": "camera", "range_limit": 10}',
    }
    assert lr._is_camera_result(camera_row) is True


# ───────────── tuong thich nguoc + tong sao ─────────────

def test_truong_badges_cu_chi_gom_huy_hieu_da_dat():
    """Muc 5.11: giu nguyen 'badges' de bao cao phu huynh khong vo."""
    args = build(summary=make_summary(total_results=12, streak=3),
                 skills=make_skill_cards(alphabet_score=90),
                 camera_attempts=2, reading_words=40)
    earned = badges_of(args)
    catalog = catalog_of(args)

    earned_ids = {item["id"] for item in earned}
    catalog_earned_ids = {item["id"] for item in catalog if item["earned"]}
    assert earned_ids == catalog_earned_ids
    # Va khong lan huy hieu chua dat vao danh sach cu
    assert all(item["id"] in catalog_earned_ids for item in earned)


def test_badges_cu_van_giu_du_ten_va_mo_ta_cho_phu_huynh():
    args = build(summary=make_summary(total_results=1, streak=1))
    earned = badges_of(args)
    assert earned, "it nhat phai co huy hieu Khoi dong"
    for item in earned:
        assert item["name"] and item["description"] and item["tone"]


def test_tong_sao_cong_tu_detail_stars():
    rows = [
        {"detail_json": '{"stars": 3}'},
        {"detail_json": '{"stars": 1}'},
        {"detail_json": '{"stars": 2}'},
        {"detail_json": '{}'},          # luot khong ghi sao
        {"detail_json": None},          # du lieu hong
        {"detail_json": '{"stars": "khong phai so"}'},
    ]
    assert lr._sum_total_stars(rows) == 6


def test_tong_sao_tai_khoan_moi_la_0():
    assert lr._sum_total_stars([]) == 0
