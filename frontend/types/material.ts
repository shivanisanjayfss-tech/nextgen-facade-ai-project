export type MaterialCategory =
  | "ACP Sheet"
  | "Glass"
  | "Stone"
  | "HPL"
  | "Louvers"
  | "Metal"
  | "Composite"
  | "Other";

export interface MaterialSpecs {
  brand?: string;
  fireRating?: string;
  thermalConductivity?: string;
  weight?: string;
  thickness?: string;
  dimensions?: string;
  windLoad?: string;
  uValue?: string;
  colorOptions?: string[];
  warranty?: string;
}

export interface Material {
  id: string;
  name: string;
  slug: string;
  category: MaterialCategory;
  manufacturer: string;
  brand: string | null;
  description: string;
  specs: MaterialSpecs;
  imageUrl: string | null;
  datasheetUrl: string | null;
  sourceUrl: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MaterialSummary {
  id: string;
  name: string;
  slug: string;
  category: MaterialCategory;
  manufacturer: string;
  brand: string | null;
  description: string;
  imageUrl: string | null;
  tags: string[];
}
