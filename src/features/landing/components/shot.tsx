import Image from "next/image";

import { Reveal } from "./reveal";

/**
 * A screenshot of the running product.
 *
 * Cropped from the top to a fixed frame, because every one of these is a wide
 * screen capture and the interesting half is always the first half. The frame
 * carries the same ring and shadow the app's own panels do, so a picture of
 * the product sits on the page the way the product does.
 */
export function Shot({
  src,
  alt,
  caption,
  tall = false,
}: {
  src: string;
  alt: string;
  /** What the reader should notice in it. Never a repeat of the heading. */
  caption: string;
  tall?: boolean;
}) {
  return (
    <Reveal className="min-w-0">
      <figure>
        <div
          className={`bg-paper shadow-soft overflow-hidden rounded-xl ring-1 ring-line ${
            tall ? "aspect-[16/12]" : "aspect-[16/9]"
          }`}
        >
          <Image
            src={src}
            alt={alt}
            width={1800}
            height={1070}
            className="size-full object-cover object-top"
          />
        </div>
        <figcaption className="mt-2.5 text-[12.5px] leading-snug text-muted">{caption}</figcaption>
      </figure>
    </Reveal>
  );
}
