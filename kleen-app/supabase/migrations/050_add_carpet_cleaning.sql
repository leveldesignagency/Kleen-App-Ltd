-- Add Carpet Cleaning to the interior service catalogue.

insert into public.service_categories (id, name, slug, description, icon, display_order, is_active)
values (
  'interior',
  'Interior Cleaning',
  'interior',
  'Full house, room-by-room, carpet, or specific area cleaning',
  'Sparkles',
  2,
  true
)
on conflict (id) do update set
  description = excluded.description,
  is_active = true;

insert into public.services (
  id, category_id, name, slug, description,
  base_price_pence, price_per_unit_pence, estimated_duration_min,
  min_operatives, max_operatives, is_active
) values (
  'carpet-clean',
  'interior',
  'Carpet Cleaning',
  'carpet-clean',
  'Professional carpet and rug cleaning for homes and offices',
  7500,
  2500,
  90,
  1,
  2,
  true
)
on conflict (id) do update set
  category_id = excluded.category_id,
  name = excluded.name,
  slug = excluded.slug,
  description = excluded.description,
  base_price_pence = excluded.base_price_pence,
  price_per_unit_pence = excluded.price_per_unit_pence,
  estimated_duration_min = excluded.estimated_duration_min,
  min_operatives = excluded.min_operatives,
  max_operatives = excluded.max_operatives,
  is_active = true;
