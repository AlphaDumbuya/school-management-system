# WiSkul Public Theme Guide

The public/marketing theme is a **light, professional edu-SaaS** look inspired by
classic education-management sites: a soft off-white page, **deep navy-blue** brand
sections and icon badges, **orange** call-to-action accents, and clean white cards
with soft shadows.

Use these tokens consistently across all public pages (Landing, Features, Pricing,
Why, Benefits, Contact) and the public navbar.

---

## Color tokens

| Token | Hex | Usage |
|-------|-----|-------|
| **Navy (brand deep)** | `#1a2b6b` | Hero background, full-width blue bands, footer top, utility bar |
| **Navy 2 (gradient end)** | `#20308a` | Subtle gradient partner for navy bands |
| **Blue (primary)** | `#1d4ed8` | Brand text (logo "Skul"), links, icon badges, section accents |
| **Blue 700 (hover)** | `#1e40af` | Primary button/link hover |
| **Blue 50** | `#eff6ff` | Tinted chips, light icon badge backgrounds |
| **Orange (CTA)** | `#f59e0b` | Primary CTA buttons ("Register", "Get in Touch"), highlight text |
| **Orange 600 (hover)** | `#d97706` | CTA hover |
| **Amber 300/400** | `#fbbf24` / `#fcd34d` | Accent text on navy backgrounds, checkmarks |
| **Page background** | `#f5f7fb` | Body background (soft off-white blue-gray) — NOT pure white |
| **Card background** | `#ffffff` | Cards, panels |
| **Ink (headings)** | `#0f172a` | Headings on light |
| **Body text** | `#475569` (slate-600) | Paragraph text on light |
| **Muted** | `#94a3b8` (slate-400) | Captions, footnotes |
| **Border** | `#e5e9f2` | Card/section borders on light |

### On navy backgrounds
- Headings: `#ffffff`
- Body: `#c7d2fe` / `#e0e7ff` (indigo-100/200)
- Accent: `#fbbf24` (amber-300)

---

## Backgrounds

- **Page:** `bg-[#f5f7fb]` (soft off-white). Never pure white for the full page.
- **Navy hero / bands:** `bg-[#1a2b6b]` with an optional decorative dotted or
  line-art overlay at low opacity (`opacity-[0.12]`).
- **Dotted pattern overlay (navy):**
  ```
  backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)'
  backgroundSize: '26px 26px'
  ```
- **Cards** sit on the page bg as white blocks: `bg-white rounded-2xl border border-[#e5e9f2] shadow-sm`.

---

## Components

### Buttons
- **Primary CTA (orange):**
  `bg-[#f59e0b] hover:bg-[#d97706] text-white font-bold rounded-lg px-8 py-3.5 shadow-lg shadow-amber-500/25`
- **Secondary on navy:** `border border-white/30 hover:border-white/50 bg-white/5 text-white rounded-lg`
- **Secondary on light:** `bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg` OR
  `border border-slate-200 bg-white text-slate-700`

### Icon badge (feature rows)
- Circular deep-blue badge: `w-12 h-12 rounded-full bg-[#1d4ed8] text-white flex items-center justify-center`
- On light cards, a soft variant: `rounded-2xl bg-blue-50 text-[#1d4ed8]`

### Cards
`bg-white rounded-2xl border border-[#e5e9f2] shadow-sm hover:shadow-lg transition`

### Section header
- Eyebrow: `text-[#1d4ed8] text-xs font-bold tracking-[0.2em] uppercase`
- Title: `text-3xl sm:text-4xl font-black text-[#0f172a] tracking-tight`
- Optional short underline accent: a `w-12 h-1 bg-[#f59e0b] rounded-full mx-auto`

### Checkmark bullets
- On navy: amber circle `bg-amber-400 text-[#1a2b6b]` with a white check.
- On light: blue circle `bg-blue-100 text-[#1d4ed8]`.

### Badges/pills
- Free/included: `bg-blue-100 text-[#1d4ed8]`
- Coming soon: `bg-amber-100 text-amber-700`

---

## Section rhythm (Landing)
1. Utility bar (navy) — contact + quick links (desktop)
2. Navbar (light glass)
3. Hero (navy band + pattern, white heading, orange CTA, amber checkmarks)
4. Stats band (light, blue-tinted stat cards)
5. Why / feature rows (light bg, white cards, blue icon badges)
6. Full-width navy band (features/modules or analytics) — white cards inside
7. Benefits (light bg, white cards, colored icon chips)
8. Navy CTA banner (orange button)
9. Footer (light, navy accents)

Alternate **light → navy → light** to create depth and match the reference.

---

## Do / Don't
- ✅ Use navy `#1a2b6b` for full-width feature/CTA bands and the hero.
- ✅ Use orange only for primary CTAs and key highlights (sparingly).
- ✅ Keep the page bg soft off-white `#f5f7fb`, cards pure white.
- ❌ Don't use the old teal `#00d4aa` on public pages.
- ❌ Don't make the whole page dark navy — it's light with navy bands.
