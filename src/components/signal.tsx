import { Children, type ComponentProps, type ReactNode } from "react";
import { AlertIcon, CheckIcon, InfoIcon } from "@/components/icons";

// Signal color lives on a small glyph, like the saved wishlist heart; the
// message itself stays ink. The glyph fades in when it appears.

export type Tone = "success" | "warning" | "danger" | "info";

const glyphs = {
  success: { Glyph: CheckIcon, color: "text-success" },
  warning: { Glyph: AlertIcon, color: "text-warning" },
  danger: { Glyph: AlertIcon, color: "text-danger" },
  info: { Glyph: InfoIcon, color: "text-muted" },
};

// Sized and nudged to sit on the first line of caption or body-sm text.
const sizes = {
  caption: { text: "text-caption", glyph: "mt-px size-3.5" },
  "body-sm": { text: "text-body-sm", glyph: "mt-0.5 size-4" },
};

type Size = keyof typeof sizes;

export function SignalIcon({ tone, size = "body-sm" }: { tone: Tone; size?: Size }) {
  const { Glyph, color } = glyphs[tone];
  return (
    <Glyph
      strokeWidth={1.5}
      className={`shrink-0 animate-signal-in transition-colors ${color} ${sizes[size].glyph}`}
    />
  );
}

type MessageProps = Omit<ComponentProps<"p">, "children"> & {
  tone: Tone;
  size?: Size;
  children?: ReactNode;
};

// The element always renders so a `role="status"` live region exists before
// its first message; with no message it's empty, so `empty:` classes still apply.
export function SignalMessage({
  tone,
  size = "body-sm",
  className = "",
  children,
  ...props
}: MessageProps) {
  const hasMessage = Children.toArray(children).some((child) => child !== "");
  return (
    <p className={`flex items-start gap-2 ${sizes[size].text} ${className}`} {...props}>
      {hasMessage && (
        <>
          <SignalIcon tone={tone} size={size} />
          <span>{children}</span>
        </>
      )}
    </p>
  );
}

// Hairline notice box for page-level messages.
export function Notice({
  tone,
  className = "",
  children,
  ...props
}: ComponentProps<"div"> & { tone: Tone }) {
  return (
    <div
      className={`flex items-start gap-3 border px-4 py-3 text-body-sm ${className}`}
      {...props}
    >
      <SignalIcon tone={tone} />
      <div>{children}</div>
    </div>
  );
}
