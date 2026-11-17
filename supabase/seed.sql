-- Demo operational data for farmers who already have fields.
-- Safe to re-run: skips fields that already have trees / tasks / quality / scans.
-- Does not create auth users or processors (offers need a real processor account).

-- Trees (relative map markers around the grove centre)
insert into public.field_trees (field_id, x_pct, y_pct, status, issue, geom)
select
  f.id,
  v.x,
  v.y,
  v.status::public.tree_status,
  v.issue,
  st_setsrid(st_makepoint(f.lon + (v.x - 50) * 0.00008, f.lat + (50 - v.y) * 0.00008), 4326)
from public.fields f
cross join (
  values
    (22::numeric, 28::numeric, 'healthy', null::text),
    (48, 40, 'healthy', null),
    (70, 32, 'suspicious', 'peacock-spot'),
    (35, 62, 'diseased', 'peacock-spot'),
    (58, 70, 'healthy', null),
    (80, 55, 'suspicious', 'olive-fly')
) as v(x, y, status, issue)
where f.lat is not null
  and f.lon is not null
  and not exists (select 1 from public.field_trees t where t.field_id = f.id);

-- Tasks
insert into public.tasks (field_id, farmer_id, title, meta, kind, why, urgent, due_on, done)
select
  f.id,
  f.farmer_id,
  v.title,
  v.meta,
  v.kind::public.task_kind,
  v.why,
  v.urgent,
  (current_date + v.due_offset),
  false
from public.fields f
cross join (
  values
    ('Take a leaf photo', 'Tree follow-up', 'photo', 'Suspicious spots after rain', true, 0),
    ('Re-check diseased trees', 'After prune', 'recheck', 'Confirm peacock spot is not spreading', true, 3),
    ('Log last copper spray', 'Logbook', 'spray', 'Buyers need a complete EU record', false, 7)
) as v(title, meta, kind, why, urgent, due_offset)
where not exists (select 1 from public.tasks t where t.field_id = f.id);

-- Quality scores (current snapshot)
insert into public.quality_scores (field_id, farmer_id, score, breakdown, plan, engine_version)
select
  f.id,
  f.farmer_id,
  68 + (abs(hashtext(f.id::text)) % 20),
  jsonb_build_object(
    'tree', 70,
    'spray', 55,
    'harvest', 80,
    'records', 75
  ),
  jsonb_build_array(
    jsonb_build_object('text', 'Re-scan suspicious trees this week.', 'points', 4),
    jsonb_build_object('text', 'Keep spray records complete for buyers.', 'points', 3)
  ),
  'quality-seed-0.1'
from public.fields f
where not exists (select 1 from public.quality_scores q where q.field_id = f.id);

-- Sample scans (no storage image — UI shows placeholder until a real photo is uploaded)
insert into public.scans (
  field_id, farmer_id, mode, title, latin_name, diagnosis, confidence, source, captured_at
)
select
  f.id,
  f.farmer_id,
  'leaf'::public.scan_mode,
  'Peacock spot',
  'Spilocaea oleaginea',
  jsonb_build_object(
    'mode', 'leaf',
    'source', 'demo',
    'result', jsonb_build_object('label', 'Olive Peacock Spot', 'confidence', 0.82, 'symptoms', jsonb_build_array('Dark spots on upper leaf surface.')),
    'presented', jsonb_build_object(
      'mode', 'leaf',
      'title', 'Peacock spot',
      'latin', 'Spilocaea oleaginea',
      'summary', 'Dark spots on upper leaf surface.',
      'tone', 'risk',
      'pillKey', 'highRisk',
      'confidence', 0.82,
      'source', 'demo',
      'actionKind', 'care',
      'showNoChemicals', true
    )
  ),
  0.82,
  'demo',
  now() - interval '2 days'
from public.fields f
where not exists (select 1 from public.scans s where s.field_id = f.id);

insert into public.scans (
  field_id, farmer_id, mode, title, diagnosis, confidence, fly_count, source, captured_at
)
select
  f.id,
  f.farmer_id,
  'trap'::public.scan_mode,
  'Fly trap · 4 flies',
  jsonb_build_object(
    'mode', 'trap',
    'source', 'demo',
    'result', jsonb_build_object('flyCount', 4, 'notes', 'A few flies on the sticky card.', 'confidence', 0.7),
    'presented', jsonb_build_object(
      'mode', 'trap',
      'title', 'Fly trap · 4 flies',
      'summary', 'A few flies on the sticky card.',
      'tone', 'warn',
      'pillKey', 'watch',
      'confidence', 0.7,
      'source', 'demo',
      'actionKind', 'trap',
      'showNoChemicals', true
    )
  ),
  0.7,
  4,
  'demo',
  now() - interval '5 days'
from public.fields f
where (select count(*) from public.scans s where s.field_id = f.id) < 2;

-- Marketplace note:
-- Do NOT auto-create lots from fields. Lots appear only when a farmer publishes
-- via Market → New listing (`publishLot`). Seeding fake ads confuses Find olives.

-- One open buy request per processor account (optional demo request).
insert into public.buy_requests (
  processor_id, variety, tons, filled_tons, min_score, region, window_label, no_banned, shared_with_farmers, active
)
select
  p.id,
  'koroneiki',
  12,
  0,
  75,
  'Peloponnese',
  '15–25 Nov',
  true,
  true,
  true
from public.profiles p
where p.role = 'processor'
  and not exists (select 1 from public.buy_requests b where b.processor_id = p.id);
