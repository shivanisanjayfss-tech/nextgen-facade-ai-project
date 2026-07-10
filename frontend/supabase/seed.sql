-- NextGen Facade AI — Seed Data
-- Matches lib/mock-data.ts so API responses are identical after migration

-- Materials
INSERT INTO materials (id, name, slug, category, manufacturer, description, specs, image_url, datasheet_url, tags, created_at, updated_at)
VALUES
  (
    'mat-001',
    'Alucobond Plus A2',
    'alucobond-plus-a2',
    'ACP',
    '3A Composites',
    'Fire-retardant aluminium composite panel with mineral-filled core, ideal for high-rise facades requiring A2-s1,d0 classification.',
    '{"fireRating":"A2-s1, d0 (EN 13501-1)","thermalConductivity":"0.35 W/m·K","weight":"5.9 kg/m²","thickness":"4 mm","windLoad":"Up to 5.0 kPa","uValue":"0.25 W/m²K","colorOptions":["Silver Metallic","Anthracite","Pure White","Custom RAL"],"warranty":"20 years"}',
    '/images/materials/acp-alucobond.jpg',
    '/datasheets/alucobond-plus-a2',
    ARRAY['fire-rated','high-rise','metallic'],
    '2025-01-15T00:00:00Z',
    '2025-06-01T00:00:00Z'
  ),
  (
    'mat-002',
    'Guardian SunGuard SNX 60/28',
    'guardian-sunguard-snx-60-28',
    'Glass',
    'Guardian Glass',
    'Triple silver low-E coated glass delivering exceptional solar control and visible light transmission for curtain wall applications.',
    '{"fireRating":"Non-combustible","thermalConductivity":"1.0 W/m·K","weight":"25 kg/m² (6mm)","thickness":"6–12 mm","windLoad":"Per project design","uValue":"1.1 W/m²K (IGU)","colorOptions":["Neutral","Blue-Green Tint"],"warranty":"10 years coating"}',
    NULL,
    NULL,
    ARRAY['low-e','solar-control','curtain-wall'],
    '2025-02-01T00:00:00Z',
    '2025-05-20T00:00:00Z'
  ),
  (
    'mat-003',
    'Neolith Iron Corten',
    'neolith-iron-corten',
    'Stone',
    'Neolith',
    'Sintered stone surface with authentic corten steel aesthetic, UV-stable and suitable for ventilated rainscreen facades.',
    '{"fireRating":"A1 (Non-combustible)","thermalConductivity":"1.3 W/m·K","weight":"30 kg/m² (12mm)","thickness":"6–20 mm","windLoad":"Up to 4.5 kPa","uValue":"N/A (rainscreen)","colorOptions":["Iron Corten","Iron Moss","Iron Ash"],"warranty":"15 years"}',
    NULL,
    NULL,
    ARRAY['sintered-stone','rainscreen','corten-look'],
    '2025-01-20T00:00:00Z',
    '2025-04-10T00:00:00Z'
  ),
  (
    'mat-004',
    'Trespa Meteon FR',
    'trespa-meteon-fr',
    'HPL',
    'Trespa',
    'Fire-retardant high-pressure laminate cladding with through-color technology for long-lasting exterior performance.',
    '{"fireRating":"B-s1, d0 (EN 13501-1)","thermalConductivity":"0.15 W/m·K","weight":"14 kg/m² (8mm)","thickness":"6–13 mm","windLoad":"Up to 3.5 kPa","uValue":"0.18 W/m²K","colorOptions":["Wood Decors","Uni Colours","Metallic"],"warranty":"10 years"}',
    NULL,
    NULL,
    ARRAY['hpl','fire-retardant','through-color'],
    '2025-03-01T00:00:00Z',
    '2025-06-15T00:00:00Z'
  ),
  (
    'mat-005',
    'Hunter Douglas 84R Elliptical Louver',
    'hunter-douglas-84r-louver',
    'Louvers',
    'Hunter Douglas Architectural',
    'Extruded aluminium elliptical louver system for solar shading and ventilation, available in fixed and motorized configurations.',
    '{"fireRating":"A1 (Non-combustible)","thermalConductivity":"160 W/m·K (aluminium)","weight":"8 kg/m²","thickness":"84 mm blade depth","windLoad":"Up to 2.5 kPa","colorOptions":["Anodized Silver","Powder Coat RAL"],"warranty":"15 years"}',
    NULL,
    NULL,
    ARRAY['solar-shading','motorized','aluminium'],
    '2025-02-15T00:00:00Z',
    '2025-05-01T00:00:00Z'
  ),
  (
    'mat-006',
    'Zinc Standing Seam Panel',
    'zinc-standing-seam-panel',
    'Metal',
    'Rheinzink',
    'Pre-patinated titanium-zinc standing seam cladding with natural self-healing patina for premium architectural envelopes.',
    '{"fireRating":"A1 (Non-combustible)","thermalConductivity":"110 W/m·K","weight":"7 kg/m² (0.7mm)","thickness":"0.7–1.0 mm","windLoad":"Up to 4.0 kPa","colorOptions":["Pre-weathered Blue-Grey","Bright Rolled"],"warranty":"50 years material"}',
    NULL,
    NULL,
    ARRAY['zinc','standing-seam','natural-patina'],
    '2025-04-01T00:00:00Z',
    '2025-06-20T00:00:00Z'
  )
ON CONFLICT (id) DO NOTHING;

-- Datasheets
INSERT INTO datasheets (id, material_id, title, manufacturer, category, file_url, file_size, version, published_at, pages)
VALUES
  (
    'ds-mat-001',
    'mat-001',
    'Alucobond Plus A2 — Technical Datasheet',
    '3A Composites',
    'ACP',
    '/datasheets/alucobond-plus-a2',
    '2.4 MB',
    'Rev. 3.2',
    '2025-06-01T00:00:00Z',
    12
  )
ON CONFLICT (id) DO NOTHING;

-- Knowledge Articles
INSERT INTO knowledge_articles (id, slug, title, excerpt, content, category, author, read_time_minutes, published_at, tags)
VALUES
  (
    'kb-001',
    'acp-fire-ratings-explained',
    'ACP Fire Ratings Explained: A1 vs A2 vs B',
    'Understanding EN 13501-1 classifications is critical for selecting the right aluminium composite panel for your project.',
    'Aluminium composite panels are classified under EN 13501-1 based on their reaction to fire. A1 panels are non-combustible with mineral cores. A2 panels are limited combustibility with fire-retardant cores. B-rated panels have standard PE cores and are restricted on high-rise buildings in many jurisdictions.',
    'Technical Guide',
    'NextGen Facade AI',
    8,
    '2025-05-01T00:00:00Z',
    ARRAY['ACP','fire-rating','regulations']
  ),
  (
    'kb-002',
    'rainscreen-design-principles',
    'Rainscreen Design Principles for Modern Facades',
    'Best practices for ventilated rainscreen systems including cavity sizing, weather barriers, and thermal performance.',
    'A ventilated rainscreen facade consists of an outer cladding layer, ventilated cavity, insulation, and inner structure. The cavity allows moisture drainage and air circulation, improving durability and thermal performance.',
    'Best Practices',
    'NextGen Facade AI',
    12,
    '2025-04-15T00:00:00Z',
    ARRAY['rainscreen','design','moisture']
  ),
  (
    'kb-003',
    'dubai-opera-house-case-study',
    'Case Study: Dubai Opera House Glass Facade',
    'How triple-silver low-E glazing achieved 60% visible light transmission with 28% solar heat gain coefficient.',
    'The Dubai Opera House required a high-performance glass facade balancing solar control with visual transparency in a desert climate. Guardian SunGuard SNX 60/28 was specified across 12,000 m² of curtain wall.',
    'Case Study',
    'NextGen Facade AI',
    10,
    '2025-03-20T00:00:00Z',
    ARRAY['glass','case-study','solar-control']
  ),
  (
    'kb-004',
    'uae-fire-code-facade-requirements',
    'UAE Fire Code: Facade Material Requirements',
    'Summary of UAE Fire and Life Safety Code of Practice requirements for external cladding on buildings above 15m.',
    'Buildings exceeding 15 meters in height in the UAE must use A2-s1,d0 or better rated external cladding materials. PE-core ACP panels are prohibited on new construction above this threshold.',
    'Regulations',
    'NextGen Facade AI',
    6,
    '2025-06-01T00:00:00Z',
    ARRAY['regulations','UAE','fire-code']
  )
ON CONFLICT (id) DO NOTHING;
