-- Ensure the full Kleen service catalogue exists (idempotent upsert).
-- Fixes contractor "Add service" dropdown missing entries (e.g. Driveway Cleaning).

insert into public.service_categories (id, name, slug, description, icon, display_order, is_active) values
  ('exterior',   'Exterior Cleaning',    'exterior',   'Driveways, patios, decking, walls, and fences',              'Home',       1, true),
  ('interior',   'Interior Cleaning',    'interior',   'Full house, room-by-room, or specific area cleaning',        'Sparkles',   2, true),
  ('gutter',     'Gutter & Roofline',    'gutter',     'Gutter clearing, fascia, and soffit cleaning',               'CloudRain',  3, true),
  ('kitchen',    'Kitchen',              'kitchen',    'Oven, hob, extractor, and full kitchen deep cleans',          'ChefHat',    4, true),
  ('eot',        'End-of-Tenancy',       'eot',        'Move-out deep clean to landlord/agency standards',            'Key',        5, true),
  ('vehicle',    'Vehicle Cleaning',     'vehicle',    'Car valeting, interior, and exterior vehicle cleaning',       'Car',        6, true),
  ('garden',     'Garden',               'garden',     'Garden tidying, lawn care, and green waste removal',          'TreePine',   7, true),
  ('commercial', 'Commercial Cleaning',  'commercial', 'Office, retail, and commercial property cleaning',            'Building2',  8, true),
  ('waste',      'Waste Removal',        'waste',      'Rubbish clearance, recycling, and waste disposal',            'Trash2',     9, true)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  description = excluded.description,
  icon = excluded.icon,
  display_order = excluded.display_order,
  is_active = true;

insert into public.services (
  id, category_id, name, slug, description,
  base_price_pence, price_per_unit_pence, estimated_duration_min,
  min_operatives, max_operatives, is_active
) values
  ('driveway',      'exterior', 'Driveway Cleaning',       'driveway',       'High-pressure wash for driveways and paths',                    8000,  3000, 120, 1, 2, true),
  ('patio',         'exterior', 'Patio Cleaning',          'patio',          'Deep clean for patios and outdoor seating areas',                6000,  2500,  90, 1, 2, true),
  ('decking',       'exterior', 'Decking Cleaning',        'decking',        'Specialist wood or composite decking treatment',                 7000,  2800, 100, 1, 2, true),
  ('wall-fence',    'exterior', 'Wall & Fence Cleaning',   'wall-fence',     'Exterior wall and fence cleaning and restoration',               5000,  2000,  90, 1, 2, true),
  ('full-house',    'interior', 'Full House Clean',        'full-house',     'Comprehensive top-to-bottom house cleaning',                    12000,  4000, 180, 1, 3, true),
  ('room-clean',    'interior', 'Room Clean',              'room-clean',     'Individual room deep clean',                                     3500,  1500,  45, 1, 1, true),
  ('bathroom',      'interior', 'Bathroom Clean',          'bathroom',       'Specialist bathroom deep clean and sanitisation',                 4000,  1800,  60, 1, 1, true),
  ('gutter-clear',  'gutter',   'Gutter Clearing',         'gutter-clear',   'Remove debris and ensure proper drainage',                       8000,  2000,  90, 1, 2, true),
  ('fascia-soffit', 'gutter',   'Fascia & Soffit Clean',   'fascia-soffit',  'Restore roofline appearance',                                    9000,  2500, 120, 1, 2, true),
  ('oven-clean',    'kitchen',  'Oven Clean',              'oven-clean',     'Professional oven and hob deep clean',                           5500,  2000,  75, 1, 1, true),
  ('kitchen-deep',  'kitchen',  'Full Kitchen Deep Clean', 'kitchen-deep',   'Complete kitchen including appliances and surfaces',              9000,  3500, 120, 1, 2, true),
  ('eot-studio',    'eot',      'Studio / 1 Bed',          'eot-studio',     'End-of-tenancy clean for studio or 1-bed property',             15000,     0, 240, 1, 2, true),
  ('eot-2bed',      'eot',      '2–3 Bed Property',        'eot-2bed',       'End-of-tenancy clean for 2–3 bedroom property',                 22000,     0, 360, 2, 3, true),
  ('eot-4bed',      'eot',      '4+ Bed Property',         'eot-4bed',       'End-of-tenancy clean for larger properties',                    32000,     0, 480, 2, 4, true),
  ('car-exterior',  'vehicle',  'Car Exterior Wash',       'car-exterior',   'Full exterior hand wash and dry',                                3000,  1000,  45, 1, 1, true),
  ('car-interior',  'vehicle',  'Car Interior Valet',      'car-interior',   'Full interior vacuum, wipe, and freshen',                        4500,  1500,  60, 1, 1, true),
  ('car-full',      'vehicle',  'Full Valet',              'car-full',       'Complete interior and exterior valet service',                    7000,  2000,  90, 1, 1, true),
  ('garden-tidy',   'garden',   'Garden Tidy-Up',          'garden-tidy',    'General garden clearance and tidying',                           6000,  2000, 120, 1, 2, true),
  ('lawn-care',     'garden',   'Lawn Care',               'lawn-care',      'Mowing, edging, and lawn treatment',                             4000,  1500,  60, 1, 1, true),
  ('office-clean',    'commercial', 'Office Clean',           'office-clean',    'Regular or one-off office cleaning',                         10000,  4000, 120, 1, 3, true),
  ('retail-clean',    'commercial', 'Retail Premises Clean',  'retail-clean',    'Shopfront and retail unit cleaning',                          9000,  3500, 120, 1, 2, true),
  ('warehouse-clean', 'commercial', 'Warehouse / Industrial', 'warehouse-clean', 'Large-scale commercial space cleaning',                     20000,  6000, 300, 2, 6, true),
  ('general-waste',  'waste',  'General Waste Removal',   'general-waste',  'Collection and disposal of household waste',                     8000,  3000,  60, 1, 2, true),
  ('garden-waste',   'waste',  'Garden Waste Removal',    'garden-waste',   'Green waste collection and disposal',                            6000,  2500,  45, 1, 2, true)
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
