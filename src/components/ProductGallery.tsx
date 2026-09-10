"use client";

import { useState } from "react";
import ProductImage from "@/components/ProductImage";

export default function ProductGallery({
  images,
  alt,
  slug,
}: {
  images: string[];
  alt: string;
  slug?: string | null;
}) {
  const [active, setActive] = useState(0);
  const shots = images.length > 0 ? images : ["/ph/product"];

  return (
    <div className="flex flex-col-reverse gap-4 lg:flex-row">
      {shots.length > 1 && (
        <ul className="flex gap-3 overflow-x-auto scroll-thin lg:flex-col lg:overflow-visible">
          {shots.map((src, i) => (
            <li key={src + i}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`View image ${i + 1} of ${shots.length}`}
                aria-current={i === active}
                className={`block h-20 w-16 shrink-0 overflow-hidden rounded-md border transition-colors ${
                  i === active
                    ? "border-ink"
                    : "border-rule hover:border-rule-strong"
                }`}
              >
                <ProductImage
                  src={src}
                  slug={slug}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex-1 overflow-hidden rounded-xl bg-paper-sunken">
        <ProductImage
          key={shots[active]}
          src={shots[active]}
          slug={slug}
          alt={alt}
          className="aspect-[4/5] w-full object-cover animate-fade-in"
        />
      </div>
    </div>
  );
}
