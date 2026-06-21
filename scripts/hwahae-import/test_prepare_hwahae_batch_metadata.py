import importlib.util
import json
import tempfile
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
SCRIPT_PATH = ROOT_DIR / "scripts" / "hwahae-import" / "prepare_hwahae_batch.py"

spec = importlib.util.spec_from_file_location("prepare_hwahae_batch", SCRIPT_PATH)
prepare_hwahae_batch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare_hwahae_batch)


def write_json(path, payload):
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def make_row(**overrides):
    row = {
        "source": "hwahae",
        "external_type": "goods",
        "external_id": "123",
        "brand": "Brand",
        "product_name": "Fresh item",
    }
    row.update(overrides)
    return row


def prepare(path, temp_dir):
    job = prepare_hwahae_batch.discover_jobs(path.parent)[0]
    prepared_path, _counts = prepare_hwahae_batch.prepare_candidates_file(job, temp_dir=temp_dir)
    return Path(prepared_path)


def read_prepared(path):
    return json.loads(path.read_text(encoding="utf-8"))


def assert_invalid(path, temp_dir):
    try:
        job = prepare_hwahae_batch.discover_jobs(path.parent)[0]
        prepare_hwahae_batch.prepare_candidates_file(job, temp_dir=temp_dir)
    except (RuntimeError, ValueError):
        assert list(Path(temp_dir).iterdir()) == []
        return
    raise AssertionError(f"{path.name} unexpectedly passed")


def test_treatment_essence_metadata_passes(base_dir, temp_dir):
    path = base_dir / "essence.json"
    write_json(
        path,
        {
            "batch_metadata": {
                "canonical_category": "treatment",
                "product_form": "essence",
            },
            "rows": [make_row(product_name="Treatment Essence")],
        },
    )

    prepared = read_prepared(prepare(path, temp_dir))
    assert prepared[0]["category"] == "treatment"
    assert prepared[0]["product_form"] == "essence"
    assert prepared[0]["productForm"] == "essence"


def test_toner_essence_metadata_passes(base_dir, temp_dir):
    path = base_dir / "essence.json"
    write_json(
        path,
        {
            "batch_metadata": {
                "canonical_category": "toner_essence",
                "product_form": None,
            },
            "rows": [make_row(product_name="Prep Essence")],
        },
    )

    prepared = read_prepared(prepare(path, temp_dir))
    assert prepared[0]["category"] == "toner_essence"
    assert prepared[0]["product_form"] is None
    assert prepared[0]["productForm"] is None


def test_raw_essence_filename_without_metadata_fails(base_dir, temp_dir):
    path = base_dir / "essence.json"
    write_json(path, [make_row()])
    assert_invalid(path, temp_dir)


def test_name_only_essence_without_metadata_fails(base_dir, temp_dir):
    path = base_dir / "treatment.json"
    write_json(path, [make_row(product_name="Water Parsley Essence")])
    assert_invalid(path, temp_dir)


def test_legacy_category_metadata_fails(base_dir, temp_dir):
    path = base_dir / "legacy.json"
    write_json(
        path,
        {
            "batch_metadata": {
                "canonical_category": "essence",
                "product_form": None,
            },
            "rows": [make_row()],
        },
    )
    assert_invalid(path, temp_dir)


def test_treatment_null_product_form_fails(base_dir, temp_dir):
    path = base_dir / "treatment.json"
    write_json(
        path,
        {
            "batch_metadata": {
                "canonical_category": "treatment",
                "product_form": None,
            },
            "rows": [make_row()],
        },
    )
    assert_invalid(path, temp_dir)


def test_treatment_unknown_product_form_fails(base_dir, temp_dir):
    path = base_dir / "treatment.json"
    write_json(
        path,
        {
            "batch_metadata": {
                "canonical_category": "treatment",
                "product_form": "unknown",
            },
            "rows": [make_row()],
        },
    )
    assert_invalid(path, temp_dir)


def test_non_treatment_product_form_fails(base_dir, temp_dir):
    path = base_dir / "toner_essence.json"
    write_json(
        path,
        {
            "batch_metadata": {
                "canonical_category": "toner_essence",
                "product_form": "essence",
            },
            "rows": [make_row()],
        },
    )
    assert_invalid(path, temp_dir)


def test_conflicting_row_category_fails(base_dir, temp_dir):
    path = base_dir / "essence.json"
    write_json(
        path,
        {
            "batch_metadata": {
                "canonical_category": "treatment",
                "product_form": "essence",
            },
            "rows": [make_row(category="toner_essence")],
        },
    )
    assert_invalid(path, temp_dir)


def test_conflicting_row_product_form_fails(base_dir, temp_dir):
    path = base_dir / "essence.json"
    write_json(
        path,
        {
            "batch_metadata": {
                "canonical_category": "treatment",
                "product_form": "essence",
            },
            "rows": [make_row(product_form="serum")],
        },
    )
    assert_invalid(path, temp_dir)


def run_case(test_func):
    with tempfile.TemporaryDirectory(prefix="hwahae_prepare_test_") as base:
        with tempfile.TemporaryDirectory(prefix="hwahae_prepare_out_") as temp:
            test_func(Path(base), Path(temp))


def main():
    tests = [
        test_treatment_essence_metadata_passes,
        test_toner_essence_metadata_passes,
        test_raw_essence_filename_without_metadata_fails,
        test_name_only_essence_without_metadata_fails,
        test_legacy_category_metadata_fails,
        test_treatment_null_product_form_fails,
        test_treatment_unknown_product_form_fails,
        test_non_treatment_product_form_fails,
        test_conflicting_row_category_fails,
        test_conflicting_row_product_form_fails,
    ]

    for test in tests:
        run_case(test)

    print("prepare_hwahae_batch metadata checks passed")


if __name__ == "__main__":
    main()
