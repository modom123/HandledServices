/*
 * FILE    : apps/web/components/Glyph.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0215 UTC
 * PURPOSE : Modern look: the catalog keeps its emoji (they're data, and the apps and emails still use them); on the website
 *           each emoji is drawn as one consistent line icon (Lucide) in a soft green tile with a gold option.
 *           Unknown emoji fall back to a neutral icon so the set never mixes styles.
 */
import {
  AppWindow, Armchair, Banknote, Bath, BrickWall, Brush, Building, Building2, Bus, BusFront, Camera, Car, Cctv, Church, ClipboardList,
  Cog, Construction, Container, CookingPot, Dog, DoorOpen, Droplet, Droplets, Factory, Fan, FireExtinguisher, Flame, FolderOpen, Gift,
  Hammer, Hand, HandCoins, Handshake, Headphones, Hotel, House, KeyRound, Landmark, Leaf, Lightbulb, LockKeyhole, MessageCircle, Package,
  Paintbrush, Palette, PartyPopper, PawPrint, Pill, Plane, Repeat, Shield, ShieldCheck, ShoppingBag, ShoppingBasket, Siren, Snowflake,
  Sofa, Sparkles, SprayCan, Sprout, Star, Stethoscope, Store, Ticket, Trash2, TreeDeciduous, Trophy, Truck, UtensilsCrossed, Wine, Wrench,
  CircleCheck, type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  "🧽": SprayCan, "✨": Sparkles, "🧼": Brush, "🪟": AppWindow, "🧺": ShoppingBasket, "🔁": Repeat, "💦": Droplets,
  "🌳": TreeDeciduous, "🌱": Sprout, "🍂": Leaf, "❄️": Snowflake,
  "🐾": PawPrint, "🦮": Dog, "🐶": Dog, "🐕": Dog,
  "🚛": Truck, "🚚": Truck, "📦": Package, "🛋️": Sofa, "🗑️": Trash2, "🛢️": Container, "🧤": Hand,
  "🔧": Wrench, "🔑": KeyRound, "🚰": Droplet, "🔥": Flame, "💡": Lightbulb, "📹": Cctv, "🌀": Fan, "⚙️": Cog, "🚪": DoorOpen,
  "🧯": FireExtinguisher, "🖌️": Paintbrush, "🎨": Palette, "🧱": BrickWall, "🛁": Bath, "🍳": CookingPot, "🏗️": Construction,
  "🛍️": ShoppingBag, "💊": Pill, "🗂️": FolderOpen,
  "🚘": Car, "🚗": Car, "🚨": Siren, "✈️": Plane, "🚌": Bus, "🚐": BusFront, "🏟️": Ticket,
  "🎉": PartyPopper, "🎈": PartyPopper, "🥂": Wine, "🍽️": UtensilsCrossed, "🎧": Headphones, "🪑": Armchair,
  "🛡️": Shield, "👮": ShieldCheck, "🔐": LockKeyhole,
  "🏠": House, "🏡": House, "🏘️": Building, "🏢": Building2, "🏬": Store, "🏨": Hotel, "🏭": Factory, "🏛️": Landmark, "⛪": Church, "🩺": Stethoscope,
  "🧰": Hammer, "🤝": Handshake, "💵": Banknote, "💸": HandCoins, "🎁": Gift, "🏆": Trophy, "⭐": Star, "💬": MessageCircle, "📋": ClipboardList, "📸": Camera,
};

const SIZE = { sm: "h-8 w-8 rounded-lg", md: "h-11 w-11 rounded-xl", lg: "h-14 w-14 rounded-2xl" } as const;
const ICON = { sm: 16, md: 22, lg: 28 } as const;

/** An emoji from the catalog, drawn as a line icon in a tile. tone "gold" for highlights on deep green. */
export function Glyph({ icon, size = "md", tone = "green", className = "" }: { icon?: string | null; size?: keyof typeof SIZE; tone?: "green" | "gold" | "plain"; className?: string }) {
  const I = (icon && MAP[icon.trim()]) || CircleCheck;
  const t = tone === "gold" ? "bg-gold/15 text-gold-light ring-1 ring-gold/30" : tone === "plain" ? "text-brand" : "bg-brand-tint text-brand ring-1 ring-brand/10";
  return <span className={`inline-grid shrink-0 place-items-center ${tone === "plain" ? "" : SIZE[size]} ${t} ${className}`} aria-hidden><I size={ICON[size]} strokeWidth={1.75} /></span>;
}

/** Emoji in the Original and Green-white-gold looks, a line-icon tile in the Modern look (switched by CSS, so it works anywhere). */
export function ThemedIcon({ icon, size = "sm", emojiClass = "" }: { icon?: string | null; size?: keyof typeof SIZE; emojiClass?: string }) {
  return (<><span className={`ti-emoji ${emojiClass}`}>{icon}</span><Glyph icon={icon} size={size} className="ti-icon" /></>);
}
