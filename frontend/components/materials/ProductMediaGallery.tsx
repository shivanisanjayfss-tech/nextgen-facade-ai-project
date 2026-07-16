"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/components/materials/ProductImage";
import { resolveProductImageUrl } from "@/lib/product-image-url";

interface ProductMediaGalleryProps {
  images: string[];
  productName: string;
  category: string;
  imageUrl: string | null;
  /** When false, only the hero image is shown (no thumbnail strip). */
  showThumbnails?: boolean;
}

function resolveGalleryImages(images: string[], imageUrl: string | null): string[] {
  const resolved: string[] = [];
  const seen = new Set<string>();

  const add = (url?: string | null) => {
    const normalized = resolveProductImageUrl(url);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    resolved.push(normalized);
  };

  add(imageUrl);

  for (const image of images) {
    add(image);
  }

  return resolved;
}

function ProductImagePlaceholder({ category }: { category: string }) {
  return (
    <div className="flex aspect-[5/4] w-full items-center justify-center bg-[#0d1424] sm:aspect-[4/3]">
      <div className="text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl border border-white/10 bg-white/5 font-mono text-2xl font-bold text-white/25">
          {category.slice(0, 2).toUpperCase()}
        </div>
        <p className="mt-4 text-sm text-white/35">No product image available</p>
      </div>
    </div>
  );
}

/** Interactive product image viewer with optional thumbnail gallery. */
export function ProductMediaGallery({
  images,
  productName,
  category,
  imageUrl,
  showThumbnails = true,
}: ProductMediaGalleryProps) {
  const resolvedImages = useMemo(
    () => resolveGalleryImages(images, imageUrl),
    [images, imageUrl],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());

  const availableImages = useMemo(
    () => resolvedImages.filter((url) => !failedUrls.has(url)),
    [resolvedImages, failedUrls],
  );

  const safeActiveIndex =
    availableImages.length === 0
      ? 0
      : Math.min(activeIndex, availableImages.length - 1);

  const activeImage = availableImages[safeActiveIndex];

  const handleImageError = (url: string) => {
    setFailedUrls((current) => {
      const next = new Set(current);
      next.add(url);
      return next;
    });
    setActiveIndex((index) => index + 1);
  };

  if (availableImages.length === 0 || !activeImage) {
    return <ProductImagePlaceholder category={category} />;
  }

  return (
    <div className="bg-[#0d1424]">
      <button
        type="button"
        onClick={() => window.open(activeImage, "_blank", "noopener,noreferrer")}
        className="group relative block aspect-[5/4] w-full cursor-zoom-in sm:aspect-[4/3]"
        aria-label={`View full image of ${productName}`}
      >
        <ProductImage
          key={activeImage}
          imageUrl={activeImage}
          alt={productName}
          fallbackLabel={category}
          fill
          priority={safeActiveIndex === 0}
          sizes="(max-width: 1024px) 100vw, 60vw"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.01]"
          onError={() => handleImageError(activeImage)}
        />
        <span className="absolute bottom-4 right-4 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-xs text-white/70 opacity-0 transition-opacity group-hover:opacity-100">
          View full image
        </span>
      </button>

      {showThumbnails && availableImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto border-t border-white/[0.06] p-4">
          {availableImages.map((galleryImageUrl, index) => {
            const isActive = index === safeActiveIndex;

            return (
              <button
                key={`${galleryImageUrl}-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Show image ${index + 1} of ${availableImages.length}`}
                aria-pressed={isActive}
                className={cn(
                  "relative h-16 w-20 shrink-0 overflow-hidden rounded-xl border transition-all sm:h-20 sm:w-24",
                  isActive
                    ? "border-sky-400/50 ring-2 ring-sky-400/30"
                    : "border-white/10 opacity-70 hover:border-white/20 hover:opacity-100",
                )}
              >
                <ProductImage
                  imageUrl={galleryImageUrl}
                  alt={`${productName} thumbnail ${index + 1}`}
                  fallbackLabel={category}
                  fill
                  sizes="96px"
                  className="object-cover"
                  onError={() => handleImageError(galleryImageUrl)}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
