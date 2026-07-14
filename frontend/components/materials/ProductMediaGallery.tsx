"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ProductMediaGalleryProps {
  images: string[];
  productName: string;
  category: string;
  imageUrl: string | null;
}

function resolveGalleryImages(images: string[], imageUrl: string | null): string[] {
  const resolved: string[] = [];
  const seen = new Set<string>();

  const add = (url?: string | null) => {
    const trimmed = url?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    resolved.push(trimmed);
  };

  add(imageUrl);

  for (const image of images) {
    add(image);
  }

  return resolved;
}

function GalleryImage({
  src,
  alt,
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  if (src.startsWith("/")) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        className={className}
        sizes="(max-width: 1024px) 100vw, 60vw"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`absolute inset-0 h-full w-full ${className ?? "object-cover"}`}
      loading={priority ? "eager" : "lazy"}
      referrerPolicy="no-referrer"
    />
  );
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

/** Interactive product image viewer with thumbnail gallery. */
export function ProductMediaGallery({
  images,
  productName,
  category,
  imageUrl,
}: ProductMediaGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const resolvedImages = resolveGalleryImages(images, imageUrl);

  if (!imageUrl) {
    return <ProductImagePlaceholder category={category} />;
  }

  const activeImage = resolvedImages[activeIndex] ?? resolvedImages[0];

  return (
    <div className="bg-[#0d1424]">
      <button
        type="button"
        onClick={() => window.open(activeImage, "_blank", "noopener,noreferrer")}
        className="group relative block aspect-[5/4] w-full cursor-zoom-in sm:aspect-[4/3]"
        aria-label={`View full image of ${productName}`}
      >
        <GalleryImage
          src={activeImage}
          alt={productName}
          priority={activeIndex === 0}
          className="object-cover transition-transform duration-300 group-hover:scale-[1.01]"
        />
        <span className="absolute bottom-4 right-4 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-xs text-white/70 opacity-0 transition-opacity group-hover:opacity-100">
          View full image
        </span>
      </button>

      {resolvedImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto border-t border-white/[0.06] p-4">
          {resolvedImages.map((imageUrl, index) => {
            const isActive = index === activeIndex;

            return (
              <button
                key={`${imageUrl}-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Show image ${index + 1} of ${resolvedImages.length}`}
                aria-pressed={isActive}
                className={cn(
                  "relative h-16 w-20 shrink-0 overflow-hidden rounded-xl border transition-all sm:h-20 sm:w-24",
                  isActive
                    ? "border-sky-400/50 ring-2 ring-sky-400/30"
                    : "border-white/10 opacity-70 hover:border-white/20 hover:opacity-100",
                )}
              >
                <GalleryImage
                  src={imageUrl}
                  alt={`${productName} thumbnail ${index + 1}`}
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
