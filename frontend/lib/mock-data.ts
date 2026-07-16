import type { Datasheet, KnowledgeArticle, Material } from "@/types";

export const MOCK_MATERIALS: Material[] = [
  {
    id: "mat-002",
    name: "Guardian SunGuard SNX 60/28",
    slug: "guardian-sunguard-snx-60-28",
    category: "Glass",
    manufacturer: "Guardian Glass",
    brand: null,
    description:
      "Triple silver low-E coated glass delivering exceptional solar control and visible light transmission for curtain wall applications.",
    specs: {
      fireRating: "Non-combustible",
      thermalConductivity: "1.0 W/m·K",
      weight: "25 kg/m² (6mm)",
      thickness: "6–12 mm",
      windLoad: "Per project design",
      uValue: "1.1 W/m²K (IGU)",
      colorOptions: ["Neutral", "Blue-Green Tint"],
      warranty: "10 years coating",
    },
    imageUrl: null,
    datasheetUrl: null,
    sourceUrl: null,
    tags: ["low-e", "solar-control", "curtain-wall"],
    createdAt: "2025-02-01T00:00:00Z",
    updatedAt: "2025-05-20T00:00:00Z",
  },
  {
    id: "mat-003",
    name: "Neolith Iron Corten",
    slug: "neolith-iron-corten",
    category: "Stone",
    manufacturer: "Neolith",
    brand: null,
    description:
      "Sintered stone surface with authentic corten steel aesthetic, UV-stable and suitable for ventilated rainscreen facades.",
    specs: {
      fireRating: "A1 (Non-combustible)",
      thermalConductivity: "1.3 W/m·K",
      weight: "30 kg/m² (12mm)",
      thickness: "6–20 mm",
      windLoad: "Up to 4.5 kPa",
      uValue: "N/A (rainscreen)",
      colorOptions: ["Iron Corten", "Iron Moss", "Iron Ash"],
      warranty: "15 years",
    },
    imageUrl: null,
    datasheetUrl: null,
    sourceUrl: null,
    tags: ["sintered-stone", "rainscreen", "corten-look"],
    createdAt: "2025-01-20T00:00:00Z",
    updatedAt: "2025-04-10T00:00:00Z",
  },
  {
    id: "mat-004",
    name: "Trespa Meteon FR",
    slug: "trespa-meteon-fr",
    category: "HPL",
    manufacturer: "Trespa",
    brand: null,
    description:
      "Fire-retardant high-pressure laminate cladding with through-color technology for long-lasting exterior performance.",
    specs: {
      fireRating: "B-s1, d0 (EN 13501-1)",
      thermalConductivity: "0.15 W/m·K",
      weight: "14 kg/m² (8mm)",
      thickness: "6–13 mm",
      windLoad: "Up to 3.5 kPa",
      uValue: "0.18 W/m²K",
      colorOptions: ["Wood Decors", "Uni Colours", "Metallic"],
      warranty: "10 years",
    },
    imageUrl: null,
    datasheetUrl: null,
    sourceUrl: null,
    tags: ["hpl", "fire-retardant", "through-color"],
    createdAt: "2025-03-01T00:00:00Z",
    updatedAt: "2025-06-15T00:00:00Z",
  },
  {
    id: "mat-005",
    name: "Hunter Douglas 84R Elliptical Louver",
    slug: "hunter-douglas-84r-louver",
    category: "Louvers",
    manufacturer: "Hunter Douglas Architectural",
    brand: null,
    description:
      "Extruded aluminium elliptical louver system for solar shading and ventilation, available in fixed and motorized configurations.",
    specs: {
      fireRating: "A1 (Non-combustible)",
      thermalConductivity: "160 W/m·K (aluminium)",
      weight: "8 kg/m²",
      thickness: "84 mm blade depth",
      windLoad: "Up to 2.5 kPa",
      colorOptions: ["Anodized Silver", "Powder Coat RAL"],
      warranty: "15 years",
    },
    imageUrl: null,
    datasheetUrl: null,
    sourceUrl: null,
    tags: ["solar-shading", "motorized", "aluminium"],
    createdAt: "2025-02-15T00:00:00Z",
    updatedAt: "2025-05-01T00:00:00Z",
  },
  {
    id: "mat-006",
    name: "Zinc Standing Seam Panel",
    slug: "zinc-standing-seam-panel",
    category: "Metal",
    manufacturer: "Rheinzink",
    brand: null,
    description:
      "Pre-patinated titanium-zinc standing seam cladding with natural self-healing patina for premium architectural envelopes.",
    specs: {
      fireRating: "A1 (Non-combustible)",
      thermalConductivity: "110 W/m·K",
      weight: "7 kg/m² (0.7mm)",
      thickness: "0.7–1.0 mm",
      windLoad: "Up to 4.0 kPa",
      colorOptions: ["Pre-weathered Blue-Grey", "Bright Rolled"],
      warranty: "50 years material",
    },
    imageUrl: null,
    datasheetUrl: null,
    sourceUrl: null,
    tags: ["zinc", "standing-seam", "natural-patina"],
    createdAt: "2025-04-01T00:00:00Z",
    updatedAt: "2025-06-20T00:00:00Z",
  },
];

export const MOCK_KNOWLEDGE: KnowledgeArticle[] = [
  {
    id: "kb-001",
    slug: "acp-fire-ratings-explained",
    title: "ACP Sheet Fire Ratings Explained: A1 vs A2 vs B",
    excerpt:
      "Understanding EN 13501-1 classifications is critical for selecting the right aluminium composite panel for your project.",
    content:
      "Aluminium composite panels are classified under EN 13501-1 based on their reaction to fire. A1 panels are non-combustible with mineral cores. A2 panels are limited combustibility with fire-retardant cores. B-rated panels have standard PE cores and are restricted on high-rise buildings in many jurisdictions.",
    category: "Technical Guide",
    author: "NextGen Facade AI",
    readTimeMinutes: 8,
    publishedAt: "2025-05-01T00:00:00Z",
    tags: ["ACP Sheet", "fire-rating", "regulations"],
  },
  {
    id: "kb-002",
    slug: "rainscreen-design-principles",
    title: "Rainscreen Design Principles for Modern Facades",
    excerpt:
      "Best practices for ventilated rainscreen systems including cavity sizing, weather barriers, and thermal performance.",
    content:
      "A ventilated rainscreen facade consists of an outer cladding layer, ventilated cavity, insulation, and inner structure. The cavity allows moisture drainage and air circulation, improving durability and thermal performance.",
    category: "Best Practices",
    author: "NextGen Facade AI",
    readTimeMinutes: 12,
    publishedAt: "2025-04-15T00:00:00Z",
    tags: ["rainscreen", "design", "moisture"],
  },
  {
    id: "kb-003",
    slug: "dubai-opera-house-case-study",
    title: "Case Study: Dubai Opera House Glass Facade",
    excerpt:
      "How triple-silver low-E glazing achieved 60% visible light transmission with 28% solar heat gain coefficient.",
    content:
      "The Dubai Opera House required a high-performance glass facade balancing solar control with visual transparency in a desert climate. Guardian SunGuard SNX 60/28 was specified across 12,000 m² of curtain wall.",
    category: "Case Study",
    author: "NextGen Facade AI",
    readTimeMinutes: 10,
    publishedAt: "2025-03-20T00:00:00Z",
    tags: ["glass", "case-study", "solar-control"],
  },
  {
    id: "kb-004",
    slug: "uae-fire-code-facade-requirements",
    title: "UAE Fire Code: Facade Material Requirements",
    excerpt:
      "Summary of UAE Fire and Life Safety Code of Practice requirements for external cladding on buildings above 15m.",
    content:
      "Buildings exceeding 15 meters in height in the UAE must use A2-s1,d0 or better rated external cladding materials. PE-core ACP panels are prohibited on new construction above this threshold.",
    category: "Regulations",
    author: "NextGen Facade AI",
    readTimeMinutes: 6,
    publishedAt: "2025-06-01T00:00:00Z",
    tags: ["regulations", "UAE", "fire-code"],
  },
];

export const MOCK_DATASHEETS: Datasheet[] = MOCK_MATERIALS.filter((m) => m.datasheetUrl).map(
  (m) => ({
    id: `ds-${m.id}`,
    materialId: m.id,
    title: `${m.name} — Technical Datasheet`,
    manufacturer: m.manufacturer,
    category: m.category,
    fileUrl: m.datasheetUrl!,
    fileSize: "2.4 MB",
    version: "Rev. 3.2",
    publishedAt: m.updatedAt,
    pages: 12,
  }),
);

export function getMockMaterialById(id: string): Material | undefined {
  return MOCK_MATERIALS.find((m) => m.id === id || m.slug === id);
}

export function getMockMaterialsByIds(ids: string[]): Material[] {
  return MOCK_MATERIALS.filter((m) => ids.includes(m.id));
}
