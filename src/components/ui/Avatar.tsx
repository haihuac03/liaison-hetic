import { cn } from "@/lib/utils";

interface AvatarProps {
  src?: string;
  initials: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  tone?: "petrol" | "sage" | "peach" | "sky" | "cream";
  online?: boolean;
  className?: string;
  ring?: boolean;
}

const sizes = {
  xs: "h-6 w-6 text-[9px]",
  sm: "h-8 w-8 text-[10px]",
  md: "h-10 w-10 text-[12px]",
  lg: "h-12 w-12 text-[14px]",
  xl: "h-16 w-16 text-[18px]",
};

const tones = {
  petrol: "bg-petrol text-white",
  sage: "bg-sage text-white",
  peach: "bg-peach text-peach-dark",
  sky: "bg-sky text-sky-dark",
  cream: "bg-cream-dark text-ink",
};

export default function Avatar({
  src,
  initials,
  size = "md",
  tone = "petrol",
  online = false,
  className,
  ring = false,
}: AvatarProps) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-visible rounded-full font-bold",
        sizes[size],
        tones[tone],
        ring && "ring-2 ring-white",
        className,
      )}
    >
      <span className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </span>
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-sage" />
      )}
    </span>
  );
}
