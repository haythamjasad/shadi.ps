from api.app import _matches_search_text
import json


def reel_with_text(text: str) -> dict:
    return {"tags": [text]}


def test_tuba_matches_related_forms() -> None:
    matches = [
        "هذه طوبة",
        "الطوبة قوية",
        "هذا طوب أحمر",
        "اشتريت طوبات كثيرة",
    ]

    for text in matches:
        assert _matches_search_text(reel_with_text(text), "طوبة"), text


def test_tuba_does_not_match_unrelated_substrings() -> None:
    non_matches = [
        "الرطوبة عالية",
        "نسبة رطوبة الجو",
        "هذا مرطب",
        "عملية ترطيب",
    ]

    for text in non_matches:
        assert not _matches_search_text(reel_with_text(text), "طوبة"), text


def test_tub_matches_related_forms() -> None:
    matches = [
        "طوب",
        "الطوب",
        "طوبة",
        "طوبات",
    ]

    for text in matches:
        assert _matches_search_text(reel_with_text(text), "طوب"), text


def test_tub_and_tuba_have_same_match_family() -> None:
    samples = [
        "هذه طوبة",
        "الطوبة قوية",
        "هذا طوب أحمر",
        "اشتريت طوبات كثيرة",
        "الرطوبة عالية",
        "نسبة رطوبة الجو",
        "هذا مرطب",
        "عملية ترطيب",
        "بناء الطوب، يحتاج دقة",
    ]

    for text in samples:
        assert _matches_search_text(reel_with_text(text), "طوب") == _matches_search_text(reel_with_text(text), "طوبة"), text


def test_bartash_forms_match_same_family() -> None:
    samples = [
        "ركبت برطاش جديد",
        "هذه برطاشة قوية",
        "هذه براطيش ممتازة",
    ]

    queries = ["برطاش", "برطاشة", "براطيش"]
    for query in queries:
        for text in samples:
            assert _matches_search_text(reel_with_text(text), query), (query, text)


def test_search_matches_title_summary_transcription_and_tags() -> None:
    reel = {
        "title": "طريقة تركيب برطاشة الحمام",
        "summary": "شرح سريع لاختيار مواد العزل",
        "transcription": "نستخدم طوب قوي في بداية العمل",
        "admin_tags": '["سباكة"]',
    }

    assert _matches_search_text(reel, "برطاشة")
    assert _matches_search_text(reel, "العزل")
    assert _matches_search_text(reel, "طوبة")
    assert _matches_search_text(reel, "سباكة")


def test_search_matches_raw_row_json_summary_and_transcript() -> None:
    reel = {
        "raw_row_json": json.dumps(
            {
                "summary": "مقارنة بين أنواع اللاصق",
                "transcript": "البورسلان يحتاج مادة خاصة",
            },
            ensure_ascii=False,
        )
    }

    assert _matches_search_text(reel, "لاصق")
    assert _matches_search_text(reel, "بورسلان")
