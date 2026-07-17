/** Confidence-scored value extracted from a datasheet. */
export interface ConfidentFieldValue<T = string | string[]> {
  value: T | null;
  confidence: number;
  sourcePage?: number | null;
  manuallyEdited?: boolean;
}

export type DatasheetExtractionStatus =
  | "queued"
  | "downloading"
  | "text_extracted"
  | "ai_extracted"
  | "completed"
  | "failed";

export type DatasheetIntelligenceStatus =
  | "pending"
  | "downloading"
  | "extracting"
  | "analyzing"
  | "completed"
  | "failed";

export interface DatasheetRawPage {
  page: number;
  text: string;
}

export interface DatasheetExtractedFields {
  productName: ConfidentFieldValue;
  manufacturer: ConfidentFieldValue;
  category: ConfidentFieldValue;
  thickness: ConfidentFieldValue;
  width: ConfidentFieldValue;
  length: ConfidentFieldValue;
  weight: ConfidentFieldValue;
  fireRating: ConfidentFieldValue;
  thermalProperties: ConfidentFieldValue;
  acousticProperties: ConfidentFieldValue;
  finish: ConfidentFieldValue;
  coating: ConfidentFieldValue;
  materialComposition: ConfidentFieldValue;
  warranty: ConfidentFieldValue;
  certifications: ConfidentFieldValue<string[]>;
  applications: ConfidentFieldValue<string[]>;
  installationNotes: ConfidentFieldValue;
  standards: ConfidentFieldValue<string[]>;
}

export interface DatasheetIntelligence {
  id: string;
  materialId: string;
  sourceUrl: string;
  status: DatasheetIntelligenceStatus;
  extractionStatus: DatasheetExtractionStatus | null;
  pageCount: number | null;
  rawPages: DatasheetRawPage[];
  extractedFields: DatasheetExtractedFields;
  manualOverrides: Partial<DatasheetExtractedFields>;
  effectiveFields: DatasheetExtractedFields;
  aiSummary: string | null;
  technicalHighlights: string[];
  fireRating: string | null;
  thickness: string | null;
  finish: string | null;
  thermalValue: string | null;
  certifications: string[];
  errorMessage: string | null;
  processedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DatasheetIntelligenceSearchParams {
  q?: string;
  fireRating?: string;
  thickness?: string;
  finish?: string;
  manufacturer?: string;
  manufacturerId?: string;
  thermalValue?: string;
  certification?: string;
  page?: number;
  limit?: number;
}

export interface DatasheetIntelligenceSearchHit {
  materialId: string;
  materialName: string;
  materialSlug: string;
  manufacturer: string;
  category: string;
  imageUrl: string | null;
  fireRating: string | null;
  thickness: string | null;
  finish: string | null;
  thermalValue: string | null;
  certifications: string[];
  aiSummary: string | null;
  technicalHighlights: string[];
}

export interface DatasheetIntelligenceSearchResult {
  items: DatasheetIntelligenceSearchHit[];
  total: number;
  page: number;
  limit: number;
}

export interface DatasheetProcessResult {
  materialId: string;
  status: DatasheetIntelligenceStatus;
  extractionStatus: DatasheetExtractionStatus | null;
  errorMessage?: string | null;
}
