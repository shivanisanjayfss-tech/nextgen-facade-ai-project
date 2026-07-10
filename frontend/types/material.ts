export type MaterialCategory =
  | "ACP"
  | "Glass"
  | "Stone"
  | "HPL"
  | "Louvers"
  | "Metal"
  | "Composite"
  | "Other";

export interface MaterialSpecs {
  fireRating?: string;
  thermalConductivity?: string;
  weight?: string;
  thickness?: string;
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
  description: string;
  specs: MaterialSpecs;
  imageUrl?: string;
  datasheetUrl?: string;
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
  description: string;
  imageUrl?: string;
  tags: string[];
}
