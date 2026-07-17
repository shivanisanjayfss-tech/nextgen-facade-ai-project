import { ServiceError } from "@/lib/errors";
import type { DatasheetRawPage } from "@/types/datasheet-intelligence";

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 45_000;

export interface PdfDownloadResult {
  buffer: ArrayBuffer;
  contentType: string | null;
  byteLength: number;
}

/** Downloads a remote PDF with size and timeout guards. */
export async function downloadPdf(url: string): Promise<PdfDownloadResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/pdf,*/*",
        "User-Agent": "NextGenFacadeAI-DatasheetBot/1.0",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new ServiceError(
        `Failed to download datasheet (${response.status} ${response.statusText}).`,
        "PDF_DOWNLOAD_FAILED",
        502,
      );
    }

    const contentType = response.headers.get("content-type");
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > MAX_PDF_BYTES) {
      throw new ServiceError(
        `Datasheet exceeds ${MAX_PDF_BYTES / (1024 * 1024)}MB limit.`,
        "PDF_TOO_LARGE",
        413,
      );
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_PDF_BYTES) {
      throw new ServiceError(
        `Datasheet exceeds ${MAX_PDF_BYTES / (1024 * 1024)}MB limit.`,
        "PDF_TOO_LARGE",
        413,
      );
    }

    if (buffer.byteLength === 0) {
      throw new ServiceError("Downloaded datasheet is empty.", "PDF_EMPTY", 502);
    }

    return {
      buffer,
      contentType,
      byteLength: buffer.byteLength,
    };
  } catch (error) {
    if (error instanceof ServiceError) throw error;

    if (error instanceof Error && error.name === "AbortError") {
      throw new ServiceError(
        "Datasheet download timed out.",
        "PDF_DOWNLOAD_TIMEOUT",
        504,
      );
    }

    const message = error instanceof Error ? error.message : "Datasheet download failed.";
    throw new ServiceError(message, "PDF_DOWNLOAD_FAILED", 502);
  } finally {
    clearTimeout(timeout);
  }
}

/** Extracts per-page text from a PDF buffer. */
export async function extractPdfTextByPage(buffer: ArrayBuffer): Promise<{
  pages: DatasheetRawPage[];
  pageCount: number;
}> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { totalPages, text } = await extractText(pdf, { mergePages: false });

    const pageTexts = Array.isArray(text) ? text : [text];
    const pages: DatasheetRawPage[] = pageTexts
      .map((pageText, index) => ({
        page: index + 1,
        text: normalizePageText(pageText),
      }))
      .filter((page) => page.text.length > 0);

    if (pages.length === 0) {
      throw new ServiceError(
        "No extractable text found in datasheet PDF.",
        "PDF_NO_TEXT",
        422,
      );
    }

    return {
      pages,
      pageCount: totalPages || pages.length,
    };
  } catch (error) {
    if (error instanceof ServiceError) throw error;

    const message =
      error instanceof Error ? error.message : "PDF text extraction failed.";
    throw new ServiceError(message, "PDF_EXTRACTION_FAILED", 500);
  }
}

function normalizePageText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Concatenates page text for AI prompts with page markers. */
export function buildPromptTextFromPages(
  pages: DatasheetRawPage[],
  maxChars = 120_000,
): string {
  let output = "";

  for (const page of pages) {
    const chunk = `--- Page ${page.page} ---\n${page.text}\n\n`;
    if (output.length + chunk.length > maxChars) break;
    output += chunk;
  }

  return output.trim();
}
