# Pre-Deploy Checklist

## Data Integrity Checks

Run these in Supabase SQL before release.

### 1. Duplicate canonical products
```sql
select
  normalized_brand,
  normalized_name,
  count(*) as duplicate_count
from public.products
group by 1, 2
having count(*) > 1;
```

### 2. Missing canonical fields in products
```sql
select
  id,
  brand,
  name,
  category,
  texture,
  finish,
  irritation_risk,
  sensitivity_safe,
  skin_types,
  concerns,
  normalized_brand,
  normalized_name
from public.products
where category is null
   or texture is null
   or finish is null
   or irritation_risk is null
   or sensitivity_safe is null
   or skin_types is null
   or array_length(skin_types, 1) is null
   or concerns is null
   or array_length(concerns, 1) is null
   or normalized_brand is null
   or normalized_name is null;
```

### 3. Promoted candidates without final product target
```sql
select
  id,
  canonical_brand,
  canonical_name,
  review_status,
  matched_product_id,
  duplicate_of_product_id
from public.product_candidates
where review_status = 'promoted'
  and matched_product_id is null;
```

### 4. Promoted candidates pointing to missing products
```sql
select
  pc.id,
  pc.canonical_brand,
  pc.canonical_name,
  pc.matched_product_id
from public.product_candidates pc
left join public.products p
  on p.id = pc.matched_product_id
where pc.review_status = 'promoted'
  and p.id is null;
```

### 5. Approved candidates missing promotion payload
```sql
select
  id,
  canonical_brand,
  canonical_name,
  review_status,
  promotion_payload
from public.product_candidates
where review_status = 'approved'
  and (
    promotion_payload is null
    or promotion_payload->'product' is null
  );
```

### 6. Approved candidates missing canonical review fields
```sql
select
  id,
  canonical_brand,
  canonical_name,
  service_category,
  review_status,
  review_flags
from public.product_candidates
where review_status = 'approved'
  and (
    canonical_brand is null
    or canonical_name is null
    or service_category is null
  );
```

### 7. Auto-matched candidates with weak linkage
```sql
select
  id,
  canonical_brand,
  canonical_name,
  match_method,
  match_confidence,
  matched_product_id
from public.product_candidates
where review_status = 'auto_matched'
  and (
    matched_product_id is null
    or match_method is null
    or match_confidence is null
  );
```

### 8. Review status distribution
```sql
select
  review_status,
  count(*) as row_count
from public.product_candidates
group by 1
order by 1;
```

### 9. Candidate duplicates still waiting in queue
```sql
select
  normalized_brand,
  normalized_name,
  count(*) as row_count
from public.product_candidates
where review_status in ('new', 'auto_matched', 'needs_review', 'approved')
group by 1, 2
having count(*) > 1
order by row_count desc, normalized_brand, normalized_name;
```

## UI / App Checks

- `npm run build`
- Top Pick card shows image when `image_url` exists
- Top Pick card shows placeholder when `image_url` is missing
- `why_picked` renders as one short line when present
- `caution_note` renders as one short line when present
- No empty sections render when those fields are missing
- `/` and `/result` work in Korean
- `/en` and `/en/result` route correctly
- Language selector keeps the user on the same page family
- Analyze API still returns valid result JSON

## Ops Loop Checks

- `crawler` review/prep/promote scripts unchanged and runnable
- `public.promote_product_candidate` still promotes approved rows only
- `matched_product_id` finalizes after promotion
- `duplicate_of_product_id` is only set for merge outcomes

## Env Checks

- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
