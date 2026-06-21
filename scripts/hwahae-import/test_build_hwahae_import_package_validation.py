import csv
import json
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
BUILD_SCRIPT = ROOT_DIR / "scripts" / "hwahae-import" / "build_hwahae_import_package.py"


def write_products(path):
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["id", "brand", "name", "category"])
        writer.writeheader()
        writer.writerow({
            "id": "existing-cleanser",
            "brand": "Existing",
            "name": "Existing Cleanser",
            "category": "cleanser",
        })


def run_builder(candidate, cli_category=None):
    with tempfile.TemporaryDirectory(prefix="hwahae_package_validation_") as temp_dir:
        temp_path = Path(temp_dir)
        products_path = temp_path / "products.csv"
        candidates_path = temp_path / "candidates.json"
        out_dir = temp_path / "out"

        write_products(products_path)
        candidates_path.write_text(json.dumps([candidate], ensure_ascii=False), encoding="utf-8")

        command = [
            sys.executable,
            str(BUILD_SCRIPT),
            "--products",
            str(products_path),
            "--candidates",
            str(candidates_path),
            "--out-dir",
            str(out_dir),
        ]
        if cli_category:
            command.extend(["--category", cli_category])

        result = subprocess.run(
            command,
            cwd=ROOT_DIR,
            text=True,
            capture_output=True,
        )

        return {
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "final_json_exists": (out_dir / "hwahae_final_new_candidates.json").exists(),
            "review_csv_exists": (out_dir / "hwahae_match_review.csv").exists(),
            "filtered_csv_exists": (out_dir / "hwahae_filtered_out.csv").exists(),
        }


def make_candidate(category, product_form=None):
    candidate = {
        "id": f"candidate-{category}-{product_form or 'none'}",
        "brand": "Fresh Brand",
        "product_name": f"Fresh {category} {product_form or 'item'}",
        "category": category,
        "source_url": "https://www.hwahae.co.kr/products/123456",
    }
    if product_form is not None:
        candidate["product_form"] = product_form
    return candidate


def assert_valid(category, product_form=None):
    result = run_builder(make_candidate(category, product_form))
    assert result["returncode"] == 0, result
    assert result["final_json_exists"], result


def assert_invalid(category, product_form=None, cli_category=None):
    result = run_builder(make_candidate(category, product_form), cli_category=cli_category)
    assert result["returncode"] != 0, result
    assert not result["final_json_exists"], result
    assert not result["review_csv_exists"], result
    assert not result["filtered_csv_exists"], result


def main():
    valid_cases = [
        ("treatment", "serum"),
        ("treatment", "essence"),
        ("toner_essence", None),
        ("toner_pad", None),
        ("moisturizer_cream", None),
    ]
    invalid_cases = [
        ("serum", None),
        ("ampoule", None),
        ("essence", None),
        ("unknown", None),
        ("", None),
        ("treatment", None),
        ("treatment", "unknown"),
        ("toner_essence", "serum"),
    ]

    for category, product_form in valid_cases:
        assert_valid(category, product_form)

    for category, product_form in invalid_cases:
        assert_invalid(category, product_form)

    assert_invalid("serum", None, cli_category="treatment")

    print("build_hwahae_import_package validation checks passed")


if __name__ == "__main__":
    main()
