# Supabase — Phase 2

SQL migrations for Agro Pulse AI (PostGIS fields, RBAC, marketplace, storage, realtime).

## Apply migrations

### Option A — Supabase CLI (recommended)

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Enable the **PostGIS** extension in the dashboard if the first migration is blocked by permissions (`Database → Extensions → postgis`).

### Option B — SQL Editor

Run the files in `migrations/` **in filename order** inside the Supabase SQL Editor.

## Schema map

| Table / view | Purpose |
|---|---|
| `profiles` | `farmer` / `processor` RBAC (1:1 `auth.users`) |
| `fields` | Grove polygons `geometry(Polygon, 4326)` + `area_ha` |
| `field_trees` | Optional tree markers |
| `scans` | Leaf / fruit / trap / label diagnostics |
| `logbook_entries` | Sprays + EU banned flags |
| `quality_scores` | Score history + breakdown JSON |
| `tasks` / `risk_snapshots` | Farmer tasks & daily risk cache |
| `lots` | Harvest listings (`identity_unlocked_for` privacy) |
| `buy_requests` | Processor demand visible to farmers |
| `offers` | Bids; accept → unlock identity + create delivery |
| `deliveries` | `scheduled → weighed → lab_checked → paid` |
| `marketplace_lots` | View masking farmer name until unlock |

## Storage buckets

- `scan-images`, `label-images`, `proofs`
- Object path convention: `{auth.uid()}/filename.jpg`

## Realtime

Publication includes `offers`, `deliveries`, `lots`.

## Smoke test (after push)

1. Create two users (Auth), with `raw_user_meta_data`: `{ "role": "farmer" }` and `{ "role": "processor", "company_name": "Demo Mill" }`.
2. As farmer: insert a `fields` row (optional polygon) and a `lots` row with `status = 'listed'`.
3. As processor: `select` the lot via `marketplace_lots` — `farmer_display_name` must be `null`.
4. Processor inserts an `offers` row; farmer sets `status = 'accepted'`.
5. Confirm delivery row exists, farmer name unlocks for that processor, then advance delivery to `paid`.
