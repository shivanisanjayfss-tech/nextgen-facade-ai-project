"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { resolveProductImageUrl } from "@/lib/product-image-url";

interface ProductImageProps {
  imageUrl?: string | null;
  alt: string;
  /** Shown in the placeholder — typically product name or category. */
  fallbackLabel: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  onError?: () => void;
}

function ProductImagePlaceholder({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-white/5 font-mono text-xs font-bold text-white/30",
        className,
      )}
      aria-hidden
    >
      {label.slice(0, 2).toUpperCase()}
    </div>
  );
}

/** Renders a product image from Supabase imageUrl with a safe placeholder fallback. */
export function ProductImage({
  imageUrl,
  alt,
  fallbackLabel,
  className = "object-cover",
  fill = false,
  width,
  height,
  sizes,
  priority = false,
  onError,
}: ProductImageProps) {
  const resolvedUrl = resolveProductImageUrl(imageUrl);
  const [failed, setFailed] = useState(false);

  const handleError = () => {
    setFailed(true);
    onError?.();
  };

  if (!resolvedUrl || failed) {
    return (
      <ProductImagePlaceholder
        label={fallbackLabel}
        className={cn(fill ? "absolute inset-0" : "h-full w-full", className)}
      />
    );
  }

  // Only local assets go through the Next.js image optimizer. Remote
  // manufacturer CDNs (e.g. alucobond.com) are loaded directly because the
  // optimizer's server-side fetch to those hosts times out, which would
  // otherwise render every product image as broken.
  const isLocal = resolvedUrl.startsWith("/");

  if (isLocal) {
    if (fill) {
      return (
        <Image
          src={resolvedUrl}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className={className}
          onError={handleError}
        />
      );
    }

    return (
      <Image
        src={resolvedUrl}
        alt={alt}
        width={width ?? 56}
        height={height ?? 56}
        priority={priority}
        sizes={sizes}
        className={className}
        onError={handleError}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedUrl}
      alt={alt}
      width={width}
      height={height}
      className={cn(fill && "absolute inset-0 h-full w-full", className)}
      loading={priority ? "eager" : "lazy"}
      referrerPolicy="no-referrer"
      onError={handleError}
    />
  );
}

interface ProductThumbnailProps {
  imageUrl?: string | null;
  name: string;
  category?: string;
  className?: string;
}

/** Fixed-size product thumbnail with placeholder fallback. */
export function ProductThumbnail({
  imageUrl,
  name,
  category,
  className = "h-14 w-14",
}: ProductThumbnailProps) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#0d1424]",
        className,
      )}
    >
      <ProductImage
        imageUrl={imageUrl}
        alt={name}
        fallbackLabel={category ?? name}
        fill
        sizes="56px"
        className="object-cover"
      />
    </div>
  );
}
