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

-- Demo oil lots + oil buy requests on the fixed mailinator demo accounts only
-- (never on real team accounts). Skipped when any oil lot / oil request exists.
insert into public.lots (farmer_id, status, product, use_type, variety, tons, price_per_kg, negotiable, delivery_mode, town, region, country, lat, lon, harvest_start, harvest_end, quality_score, oil_category, acidity, harvest_season, storage, peroxide, polyphenols, pdo_pgi, organic, listed_at)
select v.farmer::uuid, 'listed', 'oil', 'oil', v.variety, v.tons, v.price, true, 'pickup', v.town, v.region, v.country::country_code, v.lat, v.lon, (timezone('Europe/Athens', now()))::date, (timezone('Europe/Athens', now()))::date + 21, v.score, v.cat, v.acid, '2026/27', v.storage, v.perox, v.poly, v.pdo, v.org, now()
from (values
 ('0b53b1be-a540-49fd-9e0e-4940233f9cdf','koroneiki',2.500,7.80,'Καλαμάτα','Messinia','GR',37.038::numeric,22.114::numeric,88,'extra_virgin',0.25::numeric,'tank',7.5::numeric,320,'ΠΟΠ Καλαμάτα',true),
 ('398c1799-7b34-450a-b320-e54768ce4a33','koroneiki',1.200,6.90,'Άμφισσα','Phocis','GR',38.527,22.377,82,'extra_virgin',0.45,'ibc',9.0,240,null,false),
 ('b066489e-a61f-4e57-b3e6-f8b055f1a03a','koroneiki',8.000,5.40,'Μυτιλήνη','Lesvos','GR',39.110,26.555,74,'virgin',1.20,'tank',12.0,150,null,false),
 ('b7900af0-8621-4b04-8c4d-3fd237cb7912','ayvalik',3.000,6.20,'Ayvalık','Balıkesir','TR',39.319,26.695,80,'extra_virgin',0.60,'ibc',10.0,210,null,false),
 ('b52b5b6c-ce27-48ee-b5f6-23d83b196379','memecik',0.500,9.50,'Edremit','Balıkesir','TR',39.596,27.024,90,'extra_virgin',0.20,'bottles',6.0,410,'Edremit Körfezi PDO',true),
 ('0b53b1be-a540-49fd-9e0e-4940233f9cdf','koroneiki',1.800,4.50,'Καλαμάτα','Messinia','GR',37.050,22.130,68,'virgin',1.50,'tins',14.0,110,null,false)
) as v(farmer,variety,tons,price,town,region,country,lat,lon,score,cat,acid,storage,perox,poly,pdo,org)
where not exists (select 1 from public.lots l where l.product='oil')
  and exists (select 1 from public.profiles pr where pr.id = v.farmer::uuid);
insert into public.buy_requests (processor_id, product, variety, tons, filled_tons, min_score, region, window_label, no_banned, shared_with_farmers, active, max_acidity, oil_category)
select v.p::uuid, 'oil', v.variety, v.tons, 0, v.ms, v.region, '25 Nov – 15 Dec', true, true, true, v.ma, v.cat
from (values
 ('ec0837af-876f-403d-9a08-fb7875db901d','koroneiki',5.000,70,'Lesvos',0.80::numeric,'extra_virgin'),
 ('27163d5a-0298-4440-8338-7ddbff7143b6','ayvalik',10.000,60,'Balıkesir',2.00,'virgin')
) as v(p,variety,tons,ms,region,ma,cat)
where not exists (select 1 from public.buy_requests b where b.product='oil')
  and exists (select 1 from public.profiles pr where pr.id = v.p::uuid);
