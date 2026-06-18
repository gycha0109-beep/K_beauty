import argparse
import csv
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DATA_DIR = ROOT_DIR / "data" / "hwahae"
BUILD_SCRIPT = Path(__file__).resolve().parent / "build_hwahae_import_package.py"
TREATMENT_CATEGORY = "treatment"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")
os.environ.setdefault("PYTHONUTF8", "1")
os.environ.setdefault("PYTHONIOENCODING", "utf-8")

CATEGORY_BY_FILENAME = {
    "클렌저": "cleanser",
    "클렌징": "cleanser",
    "토너": "toner_essence",
    "토너에센스": "toner_essence",
    "토너_에센스": "toner_essence",
    "토너패드": "toner_pad",
    "토너_패드": "toner_pad",
    "toner_pad": "toner_pad",
    "세럼": TREATMENT_CATEGORY,
    "serum": TREATMENT_CATEGORY,
    "앰플": TREATMENT_CATEGORY,
    "ampoule": TREATMENT_CATEGORY,
    "에센스": TREATMENT_CATEGORY,
    "essence": TREATMENT_CATEGORY,
    "treatment": TREATMENT_CATEGORY,
    "각질": TREATMENT_CATEGORY,
    "로션": "moisturizer_lotion_emulsion",
    "에멀전": "moisturizer_lotion_emulsion",
    "에멀젼": "moisturizer_lotion_emulsion",
    "밀크": "moisturizer_lotion_emulsion",
    "플루이드": "moisturizer_lotion_emulsion",
    "moisturizer_lotion_emulsion": "moisturizer_lotion_emulsion",
    "젤": "moisturizer_gel",
    "수딩젤": "moisturizer_gel",
    "워터젤": "moisturizer_gel",
    "moisturizer_gel": "moisturizer_gel",
    "크림": "moisturizer_cream",
    "수딩크림": "moisturizer_cream",
    "장벽크림": "moisturizer_cream",
    "moisturizer_cream": "moisturizer_cream",
    "밤": "moisturizer_balm",
    "시카밤": "moisturizer_balm",
    "멀티밤": "moisturizer_balm",
    "moisturizer_balm": "moisturizer_balm",
    "선크림": "sunscreen",
    "선케어": "sunscreen",
    "자외선차단제": "sunscreen",
    "sunscreen": "sunscreen",
}

PRODUCT_FORM_KEYWORDS = (
    ("ampoule", ("앰플", "ampoule")),
    ("essence", ("에센스", "essence")),
    ("serum", ("세럼", "serum")),
    ("booster", ("부스터", "booster")),
    (
        "peeling_solution",
        ("필링", "peeling", "peel", "acid", "애시드", "아하", "바하", "파하", "aha", "bha", "pha"),
    ),
)


def load_dotenv(path):
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def get_required_env(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def normalize_supabase_url(value):
    return value if value.startswith("http") else f"https://{value}"


def strip_rank_suffix(stem):
    normalized = stem.strip().lower().replace("-", "_").replace(" ", "_")
    normalized = re.sub(r"_?top\d+$", "", normalized)
    normalized = re.sub(r"_?\d+개$", "", normalized)
    return normalized.strip("_")


def infer_category(path):
    key = strip_rank_suffix(path.stem)
    category = CATEGORY_BY_FILENAME.get(key)
    if not category:
        valid = ", ".join(sorted(CATEGORY_BY_FILENAME))
        raise RuntimeError(
            f"Cannot infer category from {path.name!r}. Rename it to a known category name. Known names: {valid}"
        )
    return category


def extract_candidate_name(row):
    value = row.get("product_name") or row.get("productName") or row.get("name") or ""
    if value:
        return str(value)

    item = row.get("item")
    if isinstance(item, dict):
        return str(item.get("name") or "")

    return ""


def infer_product_form(name):
    text = str(name or "").lower()
    for product_form, keywords in PRODUCT_FORM_KEYWORDS:
        if any(keyword.lower() in text for keyword in keywords):
            return product_form
    return "unknown"


def read_json_rows(path):
    with path.open("r", encoding="utf-8-sig") as f:
        data = json.load(f)

    if isinstance(data, list):
        return data

    if isinstance(data, dict):
        for key in ("rows", "data", "products", "candidates", "items", "itemListElement"):
            value = data.get(key)
            if isinstance(value, list):
                return value

        graph = data.get("@graph")
        if isinstance(graph, list):
            for item in graph:
                if isinstance(item, dict) and isinstance(item.get("itemListElement"), list):
                    return item["itemListElement"]

    raise ValueError(f"{path} JSON must be a list or an object containing candidate rows.")


def augment_treatment_candidates(rows):
    augmented = []
    counts = {}

    for row in rows:
        if not isinstance(row, dict):
            continue

        product_form = infer_product_form(extract_candidate_name(row))
        counts[product_form] = counts.get(product_form, 0) + 1
        augmented.append(
            {
                **row,
                "category": TREATMENT_CATEGORY,
                "inferredCategory": TREATMENT_CATEGORY,
                "product_form": product_form,
                "productForm": product_form,
            }
        )

    return augmented, counts


def prepare_candidates_file(job, temp_dir=None):
    if job["category"] != TREATMENT_CATEGORY:
        return job["file"], None

    rows = read_json_rows(job["file"])
    augmented, counts = augment_treatment_candidates(rows)

    if temp_dir is None:
        return job["file"], counts

    prepared_path = Path(temp_dir) / f"{job['file'].stem}_prepared_candidates.json"
    with prepared_path.open("w", encoding="utf-8") as f:
        json.dump(augmented, f, ensure_ascii=False, indent=2)

    return prepared_path, counts


def format_product_form_counts(counts):
    if not counts:
        return ""
    return ", ".join(f"{key}={counts[key]}" for key in sorted(counts))


def discover_jobs(data_dir):
    jobs = []
    for path in sorted(data_dir.glob("*.json")):
        if path.name.startswith("."):
            continue
        category = infer_category(path)
        jobs.append(
            {
                "file": path,
                "label": strip_rank_suffix(path.stem),
                "category": category,
                "out_dir": data_dir / f"product_out_{strip_rank_suffix(path.stem)}",
            }
        )
    return jobs


def fetch_products(supabase_url, service_role_key):
    products = []
    page_size = 1000
    offset = 0
    encoded_select = urllib.parse.quote("id,brand,name,category", safe=",")
    base_url = f"{supabase_url.rstrip('/')}/rest/v1/products?select={encoded_select}&order=brand.asc,name.asc"
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Accept": "application/json",
    }

    while True:
        request = urllib.request.Request(base_url, headers={**headers, "Range": f"{offset}-{offset + page_size - 1}"})
        with urllib.request.urlopen(request, timeout=30) as response:
            batch = json.loads(response.read().decode("utf-8"))
        if not isinstance(batch, list):
            raise RuntimeError("Unexpected Supabase products response; expected a JSON array.")
        products.extend(batch)
        if len(batch) < page_size:
            return products
        offset += page_size


def write_products_csv(path, products):
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["id", "brand", "name", "category"], extrasaction="ignore")
        writer.writeheader()
        writer.writerows(products)


def find_manual_overrides(data_dir):
    for filename in ("manual_overrides.txt", "manual_overrides.ids", "manual_overrides.csv"):
        path = data_dir / filename
        if path.exists():
            return path
    return data_dir / "manual_overrides.txt"


def run_job(job, products_csv, manual_overrides, dry_run=False, temp_dir=None):
    candidates_file, product_form_counts = prepare_candidates_file(job, temp_dir=temp_dir)
    command = [
        sys.executable,
        str(BUILD_SCRIPT),
        "--products",
        str(products_csv),
        "--candidates",
        str(candidates_file),
        "--category",
        job["category"],
        "--out-dir",
        str(job["out_dir"]),
    ]

    if manual_overrides.exists():
        command.extend(["--manual-overrides", str(manual_overrides)])

    print(f"\n[{job['label']}] {job['file'].name} -> {job['category']} -> {job['out_dir']}", flush=True)
    if product_form_counts is not None:
        print(f"product_form counts: {format_product_form_counts(product_form_counts)}", flush=True)
    if dry_run:
        print(" ".join(f'"{part}"' if " " in part else part for part in command))
        return

    subprocess.run(command, cwd=ROOT_DIR, check=True)


def main():
    parser = argparse.ArgumentParser(
        description="Prepare Hwahae category JSON files into per-category product_out folders using live Supabase products."
    )
    parser.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR), help="Directory containing category-named Hwahae JSON files.")
    parser.add_argument("--dry-run", action="store_true", help="Print planned jobs without creating output files.")
    args = parser.parse_args()

    load_dotenv(ROOT_DIR / ".env")
    load_dotenv(ROOT_DIR / ".env.local")

    data_dir = Path(args.data_dir)
    if not data_dir.is_absolute():
        data_dir = ROOT_DIR / data_dir

    if not data_dir.exists():
        raise RuntimeError(f"Data directory does not exist: {data_dir}")

    jobs = discover_jobs(data_dir)
    if not jobs:
        print(f"No category JSON files found in {data_dir}")
        return

    manual_overrides = find_manual_overrides(data_dir)

    print(f"Found {len(jobs)} Hwahae JSON file(s).")
    if args.dry_run:
        products_csv = data_dir / "_live_products_rows.csv"
        for job in jobs:
            run_job(job, products_csv, manual_overrides, dry_run=True)
        return

    supabase_url = normalize_supabase_url(get_required_env("NEXT_PUBLIC_SUPABASE_URL"))
    service_role_key = get_required_env("SUPABASE_SERVICE_ROLE_KEY")

    products = fetch_products(supabase_url, service_role_key)
    print(f"Fetched {len(products)} live Supabase product(s).")

    with tempfile.TemporaryDirectory(prefix="hwahae_products_") as temp_dir:
        products_csv = Path(temp_dir) / "products_rows.csv"
        write_products_csv(products_csv, products)
        for job in jobs:
            run_job(job, products_csv, manual_overrides, temp_dir=temp_dir)


if __name__ == "__main__":
    main()
