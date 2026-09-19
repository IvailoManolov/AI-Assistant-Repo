/**
 * Robby.
 *
 * Drawn rather than imported, for two reasons. A raster portrait would be one
 * more binary in a repository that is meant to be read, and this one has to
 * hold up at 20px beside a chat bubble and at 72px on the landing page: the
 * same file does both only if it is vector.
 *
 * The face is built from the product's own palette. The visor is the cobalt
 * that already means "the machine is talking" everywhere else in this app, and
 * the antenna light is coral, which is the colour of everything that acts.
 */
export function RobbyAvatar({
  size = 28,
  thinking = false,
  label = "Robby",
  className = "",
}: {
  size?: number;
  /** Lights the antenna while a reply is being worked out. */
  thinking?: boolean;
  /** Null beside the wordmark, where the name is already in the text. */
  label?: string | null;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-full ring-1 ring-line ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        {...(label === null ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
      >

        {/* The disc. Warm, so the robot sits on paper rather than on screen. */}
        <circle cx="32" cy="32" r="32" fill="var(--cream-deep)" />
        <circle cx="32" cy="32" r="31" fill="none" stroke="var(--line)" strokeWidth="2" />

        {/* Antenna. It leans very slightly, which is the whole personality. */}
        <line x1="32" y1="17" x2="32" y2="10" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" />
        <circle
          cx="32"
          cy="8.5"
          r="3.4"
          fill="var(--coral)"
          className={thinking ? "breathe pulse-alert" : undefined}
          style={{ transformOrigin: "32px 8.5px" }}
        />

        {/* Head. */}
        <rect x="12" y="16" width="40" height="34" rx="12" fill="var(--ink)" />

        {/* Ears. */}
        <rect x="7" y="28" width="5" height="11" rx="2.5" fill="var(--ink-soft)" />
        <rect x="52" y="28" width="5" height="11" rx="2.5" fill="var(--ink-soft)" />

        {/* Visor, and the two lights in it. */}
        <rect x="18" y="24" width="28" height="16" rx="8" fill="var(--cobalt)" />
        <circle cx="26" cy="32" r="3.6" fill="var(--cream)" />
        <circle cx="38" cy="32" r="3.6" fill="var(--cream)" />
        <circle cx="26.9" cy="31" r="1.3" fill="var(--ink)" />
        <circle cx="38.9" cy="31" r="1.3" fill="var(--ink)" />

        {/* Mouth: one short bar, closed. A smile would oversell what it does. */}
        <rect x="27" y="44" width="10" height="2.6" rx="1.3" fill="var(--muted)" />
      </svg>
    </span>
  );
}
