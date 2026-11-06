/*
 * FILE    : apps/web/components/Avatar.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-06_0630 UTC
 * PURPOSE : A person's round picture in Hub lists (customers, business accounts, pros, team): their profile photo
 *           (lib/person-files.ts profilePhotos) or their initials when there isn't one.
 */
export function Avatar({ url, name, size = 36 }: { url?: string | null; name?: string | null; size?: number }) {
  const initials = (name ?? "").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  const style = { width: size, height: size, minWidth: size };
  return url
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={url} alt="" loading="lazy" style={style} className="rounded-full border border-line object-cover" />
    : <span style={{ ...style, fontSize: Math.round(size * 0.38) }} aria-hidden className="inline-flex items-center justify-center rounded-full bg-paper font-bold text-ink-soft">{initials}</span>;
}
