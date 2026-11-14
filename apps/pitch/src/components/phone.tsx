import { AspectRatio } from "@astryxdesign/core/AspectRatio";
import { Card } from "@astryxdesign/core/Card";

type PhoneProps = {
  src: string;
  /** Pixel size of the file, so the browser reserves the space and nothing jumps. */
  width: number;
  height: number;
  alt: string;
  /** Load straight away only for the picture at the top of the page. */
  isPriority?: boolean;
};

// A real screenshot of the app, set in a raised Astryx card that acts as the phone.
export function Phone({ src, width, height, alt, isPriority = false }: PhoneProps) {
  return (
    <Card padding={1.5} elevation="high" width="100%" maxWidth={360}>
      <AspectRatio ratio={width / height} fit="cover">
        <img
          src={src}
          width={width}
          height={height}
          alt={alt}
          loading={isPriority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={isPriority ? "high" : "auto"}
        />
      </AspectRatio>
    </Card>
  );
}
