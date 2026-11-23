---
name: Woordkast
description: Dutch words, kept like fine china.
colors:
  delft-cobalt: "#1b4079"
  delft-cobalt-deep: "#0f2b54"
  tile-blue: "#2e5ea8"
  wash-blue: "#6e92c4"
  glaze-line: "#9db6d8"
  blue-mist: "#dce4f1"
  blue-tint: "#eef3fa"
  porcelain-white: "#ffffff"
  porcelain-cream: "#fbf8f1"
  cream-shelf: "#f0ece1"
  cream-line: "#ede8db"
  gallery-cream: "#e6e3d8"
  cool-hairline: "#e4e9f2"
  cool-hairline-strong: "#d7deea"
  ink: "#1b2638"
  ink-quote: "#34405a"
  ink-faint: "#596373"
  ink-light: "#a9b0be"
  slate-inactive: "#5a6b86"
  success-fg: "#2e5e40"
  success-solid: "#3e7a57"
  success-bg: "#e7f0ea"
  success-border: "#c2dbcb"
  caution-fg: "#8a6a1e"
  caution-solid: "#c99a2e"
  caution-bg: "#fbf1dd"
  caution-border: "#e9d5a6"
  error-fg: "#9a3b22"
  error-solid: "#b5462f"
  error-bg: "#f7e8e2"
  error-border: "#e7c6b8"
typography:
  word-hero:
    fontFamily: "Spectral, Georgia, 'Times New Roman', serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.1
  display:
    fontFamily: "Spectral, Georgia, 'Times New Roman', serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.06
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Spectral, Georgia, 'Times New Roman', serif"
    fontSize: "1.25rem"
    fontWeight: 600
  word-row:
    fontFamily: "Spectral, Georgia, 'Times New Roman', serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.15
  quote:
    fontFamily: "Spectral, Georgia, 'Times New Roman', serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
  body:
    fontFamily: "'Hanken Grotesk', system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: "'Hanken Grotesk', system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  button:
    fontFamily: "'Hanken Grotesk', system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1
  label:
    fontFamily: "'Hanken Grotesk', system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.12em"
  wordmark:
    fontFamily: "Spectral, Georgia, 'Times New Roman', serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.18em"
rounded:
  chip: "9px"
  input: "14px"
  button: "16px"
  fab: "19px"
  card: "20px"
  card-lg: "24px"
  pill: "999px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "22px"
  space-6: "26px"
  space-7: "34px"
  tap-min: "44px"
components:
  button-primary:
    backgroundColor: "{colors.delft-cobalt}"
    textColor: "{colors.porcelain-cream}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "12px 16px"
    height: "46px"
  button-primary-pressed:
    backgroundColor: "{colors.delft-cobalt-deep}"
    textColor: "{colors.porcelain-cream}"
  button-primary-disabled:
    backgroundColor: "{colors.cool-hairline-strong}"
    textColor: "{colors.porcelain-white}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.delft-cobalt}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "12px 16px"
    height: "46px"
  button-secondary-pressed:
    backgroundColor: "{colors.blue-tint}"
    textColor: "{colors.delft-cobalt}"
  button-inverted:
    backgroundColor: "{colors.porcelain-white}"
    textColor: "{colors.delft-cobalt}"
    rounded: "{rounded.pill}"
  button-success:
    backgroundColor: "{colors.success-bg}"
    textColor: "{colors.success-fg}"
    rounded: "{rounded.pill}"
    height: "48px"
  button-difficult:
    backgroundColor: "{colors.error-bg}"
    textColor: "{colors.error-fg}"
    rounded: "{rounded.pill}"
    height: "48px"
  text-input:
    backgroundColor: "{colors.porcelain-white}"
    textColor: "{colors.ink-quote}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "12px 16px"
    height: "45px"
  card:
    backgroundColor: "{colors.porcelain-white}"
    rounded: "{rounded.card}"
  practice-card:
    backgroundColor: "{colors.delft-cobalt}"
    textColor: "{colors.porcelain-cream}"
    rounded: "{rounded.card}"
    padding: "16px"
  chip-de:
    backgroundColor: "{colors.delft-cobalt}"
    textColor: "{colors.porcelain-white}"
    rounded: "{rounded.chip}"
    padding: "4px 12px"
  chip-het:
    backgroundColor: "{colors.porcelain-white}"
    textColor: "{colors.delft-cobalt}"
    rounded: "{rounded.chip}"
    padding: "4px 12px"
  notice-info:
    backgroundColor: "{colors.blue-tint}"
    textColor: "{colors.delft-cobalt}"
    rounded: "{rounded.input}"
    padding: "14px 16px"
  bottom-nav:
    backgroundColor: "{colors.porcelain-white}"
    textColor: "{colors.delft-cobalt}"
    rounded: "{rounded.pill}"
    height: "62px"
  bottom-nav-active:
    backgroundColor: "{colors.delft-cobalt}"
    textColor: "{colors.porcelain-white}"
    rounded: "{rounded.pill}"
    height: "48px"
  fab:
    backgroundColor: "{colors.delft-cobalt}"
    textColor: "{colors.porcelain-cream}"
    size: "60px"
---

# Design System: Woordkast

## Overview

**Creative North Star: "The Delft Tile"**

Every screen is a hand-painted tile: cobalt glaze on warm porcelain, one motif at a time. The palette is a single blue family on cream, painted with care, so the Dutch word on each tile is what the eye lands on. Spectral, a bookish serif, carries the Dutch words and the screen titles. Hanken Grotesk, a plain grotesque, carries every piece of interface around them. The word is the ornament; the chrome stays quiet.

The density is calm and phone-sized. One column sits in a 420px canvas with 22px gutters, and one primary action sits at the bottom of the screen. On desktop the phone floats on a deeper cream "gallery" wall with a 44px corner radius, like a tile on display. Surfaces are porcelain-white cards with hairline cool borders and soft navy-tinted shadows. Controls are pills that lift a pixel on hover and press down a pixel when tapped: soft, tactile and reassuring, never sharp or loud.

The one brand illustration is the tulip medallion (`src/components/brand.tsx`), drawn in the same five blues as the palette. It appears on the splash, the welcome screen, onboarding and empty states, and nowhere else.

**Key Characteristics:**
- One hue family (Delft cobalt) on porcelain cream. Green, amber and terracotta appear only as status colours.
- Serif for Dutch words and titles, sans for UI.
- Pills everywhere a finger lands; rounded 20px cards for content.
- Soft lift: navy-tinted shadows, a 1px hover rise, a 1px press.
- Short Material-style motion with a reduced-motion fallback for every animation.

## Colors

A single cobalt family glazed onto warm cream, plus three earthy status hues.

### Primary
- **Delft Cobalt** (`delft-cobalt`): the brand colour. Primary buttons, the FAB, the active tab pill, the practice card, `de` chips, icon glyphs and the wordmark. Exposed as `--primary`.
- **Delft Cobalt Deep** (`delft-cobalt-deep`): the pressed state of cobalt controls, and the colour of display headings (`--text-display`).
- **Tile Blue / Wash Blue / Glaze Line** (`tile-blue`, `wash-blue`, `glaze-line`): the medallion's painting colours. Glaze Line also borders focused inputs and inverted focus rings (`--primary-border`).
- **Blue Mist / Blue Tint** (`blue-mist`, `blue-tint`): the focus ring (3px Blue Mist), and the pressed fill of outlined buttons, info notices and icon wells.

### Neutral
- **Porcelain Cream** (`porcelain-cream`): the app canvas (`--bg-canvas`) and the text colour on cobalt.
- **Porcelain White** (`porcelain-white`): cards, inputs, the nav pill, `het` chips.
- **Gallery Cream** (`gallery-cream`): the wall behind the phone frame on wide screens.
- **Cream Line** (`cream-line`): warm dividers and warm-card borders.
- **Cool Hairline** (`cool-hairline`, `cool-hairline-strong`): default card and input borders, and disabled fills.
- **Ink** (`ink`): body text. **Ink Quote** (`ink-quote`): muted text and input values. **Ink Faint** (`ink-faint`): captions, eyebrows, placeholders. **Ink Light** (`ink-light`): disabled labels.
- **Slate Inactive** (`slate-inactive`): new, weak or medium mastery, and inactive controls.

### Status
- **Success** (`success-*`): "I knew it", mastered words, goal reached. Moss green.
- **Caution** (`caution-*`): "strong" mastery, unverified facts ("Article not verified yet"). Ochre.
- **Error** (`error-*`): "Still learning", validation errors. Terracotta, never pure red.

Each status comes as a set of four: `-fg` for text, `-solid` for fills, `-bg` for tinted surfaces, `-border` for strokes. Use them as a set.

### Named Rules
**The One Glaze Rule.** Blue is the only brand hue. Never introduce a second accent; new emphasis comes from cobalt depth (Deep, Tile, Wash) or from cobalt versus cream.

**The Status Is Not Decoration Rule.** Green, ochre and terracotta appear only when they mean something: a result, a mastery level, a warning. Never use them for a section colour or an illustration.

**The Figma First Rule.** Colour, spacing, radius and size tokens come from Figma (`design/figma-tokens.json` → `npm run tokens`). Never add one only in code.

## Typography

**Display Font:** Spectral (with Georgia, Times New Roman, serif)
**Body Font:** Hanken Grotesk (with system-ui, -apple-system, sans-serif)

**Character:** Spectral gives Dutch words the weight of a printed dictionary entry; Hanken Grotesk keeps the interface plain and legible. Both fonts are self-hosted (`src/assets/fonts`).

### Hierarchy
- **Word hero** (Spectral 600, 1.75rem, 1.1): the word on a flashcard, the practice-card title, the large welcome title.
- **Display** (Spectral 600, 1.375rem, 1.06, -0.01em): screen titles.
- **Title** (Spectral 600, 1.25rem): section titles and option-card names (Espresso, Ontbijt, Diner).
- **Word row** (Spectral 600, 1.125rem, 1.15): a Dutch word in a list.
- **Quote** (Spectral 500 italic, 1rem, 1.5): an example sentence in context.
- **Body** (Hanken Grotesk 400, 1rem, 1.55): explanations, glosses and notices (notices use 700).
- **Body small** (Hanken Grotesk 400, 0.875rem, 1.45): secondary lines and card metadata.
- **Button** (Hanken Grotesk 700, 1rem, 1): every button label.
- **Label** (Hanken Grotesk 700, 0.75rem, 0.12em, UPPERCASE): eyebrows such as "YOUR PLAN".
- **Wordmark** (Spectral 600, 0.75rem, 0.18em, UPPERCASE): the small "WOORDKAST" next to the tulip glyph.

### Named Rules
**The Serif Is For Dutch Rule.** Spectral is used for Dutch words, titles and example sentences only. Buttons, labels, inputs and navigation are always Hanken Grotesk.

**The Rem Rule.** Type sizes are authored in px in Figma and applied as rem (`src/lib/applyTokens.ts`), so text follows the user's text-size setting and iOS Dynamic Type. Never hard-code px font sizes.

## Layout

- **Canvas:** a single column, max 420px wide (`grid-screen-max`), full height on phones. From 480px wide, it becomes a floating phone (880px tall, 44px radius, float shadow, cream-line border) centred on the gallery-cream wall.
- **Gutter:** 22px (`space-5`) on both sides of every screen.
- **Spacing scale:** 4, 8, 12, 16, 22, 26, 34px (`space-1`…`space-7`). Note the scale steps to 22 and 26, not 20 and 24.
- **Safe areas:** the top padding respects `env(safe-area-inset-top)` (min 54px on intro screens, 34px in the app bar); the bottom nav respects the bottom inset.
- **Bottom actions:** a screen's primary actions sit in a dock that floats over the content on a progressive blur. The body keeps a spacer the dock's height, so the last row can scroll clear. Screens with tabs reserve the nav height plus 20px.
- **Tap targets:** at least 44px (`tap-min`).
- **One primary action per screen**, at the bottom, full width.

## Elevation & Depth

Hybrid: surfaces are tonally layered (cream canvas → white card), and soft shadows tinted with Delft Cobalt Deep give them a gentle lift. Shadows are never grey or black.

### Shadow Vocabulary
- **Card** (`0 8px 22px rgba(15, 43, 84, 0.07)`): content cards and the nav pill.
- **Card small** (`0 1px 2px rgba(15, 43, 84, 0.04)`): compact rows.
- **Field** (`0 2px 9px rgba(15, 43, 84, 0.05)`): search and input fields.
- **Float** (`0 16px 40px rgba(15, 43, 84, 0.13)`): the desktop phone frame and floating sheets.
- **Primary** (`0 8px 20px rgba(27, 64, 121, 0.28)`): primary buttons at rest.
- **Pressed** (`0 2px 6px rgba(27, 64, 121, 0.28)`): a primary button while held down.
- **FAB** (`0 12px 26px rgba(27, 64, 121, 0.36)`): the floating add button.
- **Success** (`0 8px 18px rgba(62, 122, 87, 0.26)`): an armed "I knew it" button.

Bars that float over content (the bottom nav and docks) use a two-layer progressive backdrop blur (3px, then 10px) with a cream tint instead of a solid band. Without backdrop-filter they fall back to a stronger cream tint.

### Named Rules
**The Cobalt Shadow Rule.** Every shadow is tinted with the palette's navy or the element's own colour. A neutral grey shadow breaks the glaze.

**The Press Lowers Rule.** On press, a raised control moves down 1px and its shadow tightens (Primary → Pressed). Disabled controls have no shadow and no movement.

## Shapes

Soft and rounded throughout, with no sharp corners. Anything a finger taps on a single line is a full pill (999px): buttons, inputs, the search field, the nav and the active tab. Content containers use 20px cards (24px for large ones), and multi-line text areas switch from pill to the 20px card radius. Chips use a tight 9px radius, notices 14px. Icon buttons and the FAB are full circles. Borders are hairlines (1px), or 1.5px on outlined buttons and icon buttons. The `het` chip is drawn with an inset 1.6px cobalt ring so it stays the same size as the filled `de` chip.

## Components

### Buttons
Soft, tactile pills: they rise 1px on hover and press 1px when tapped.
- **Shape:** full pill (999px), 45–46px tall, full width by default.
- **Primary:** Delft Cobalt fill, Porcelain Cream label, Primary shadow. Pressed: Cobalt Deep with the tighter Pressed shadow. Disabled: Cool Hairline Strong fill with a white label and no shadow.
- **Secondary:** transparent with a 1.5px cobalt outline and cobalt label. Pressed: Blue Tint fill.
- **Inverted** (on the cobalt practice card): primary turns Porcelain White with a cobalt label; secondary draws in white. Both press to Blue Tint. The focus ring switches to Glaze Line, because Blue Mist would disappear on cobalt.
- **Success / Difficult** (the "I knew it" / "Still learning" pair): share one row, 48px tall, with tinted status fill, status border and status text. While a flashcard is swiped past its commit point, the matching button "arms": it scales to 1.04 and fills solid.
- **Apple:** black with white, as Apple's guidelines require.
- **Focus:** a 3px Blue Mist ring added to the existing shadow.

### Chips
- **de:** solid Delft Cobalt with a white label. **het:** white with an inset cobalt ring and cobalt label. Hanken Grotesk 700, 0.875rem, 4px × 12px, 9px radius. The article is always shown with the word.

### Cards / Containers
- **Card:** Porcelain White, 1px Cool Hairline border (Cream Line for the warm variant), 20px radius, Card shadow.
- **Practice card:** the one solid-cobalt surface on the dashboard. 16px padding, word-hero serif title, inverted buttons. It is the screen's single primary action.
- **Option cards** (onboarding choices, Add a word): white cards with an icon well in Blue Tint, a serif title and a small sans description.

### Inputs / Fields
- **Style:** Porcelain White pill, 1px Cool Hairline border, 12px × 16px padding, 45px min height, Field shadow on the search field. Values are in Ink Quote, placeholders in Ink Faint.
- **Focus:** the border shifts to Glaze Line. There is no glow.
- **Disabled:** the field takes the cream canvas colour and faint text.
- **Search** (in the app bar): the same pill with a leading cobalt search icon and a clear button.

### Notices
Full-width rounded boxes (14px) with a 24px icon, bold body text, and a tinted status fill with a matching border. Variants: error, caution, success, and info (Blue Tint, for neutral facts such as "already in your deck").

### Navigation
- **Bottom nav:** a floating white pill (62px tall) with Card shadow and three equal tabs (Home, Deck, Settings), each with an icon and a 12px bold label. The active tab is marked by a cobalt "glass" pill (48px) that travels between tabs with a faint specular sheen; labels on it turn white once it arrives.
- **FAB:** a 60px cobalt circle with a "+", to the right of the nav pill. It collapses (width → 0, rotates its icon away) when hidden, so the nav pill grows into its space.
- **App bar:** a centred serif title with a 38px circular back button and a balancing spacer. A progress variant puts a close button and a progress bar on the row and the title below in cobalt.

### Tulip Medallion (signature)
A 172px circular tile: a white disc with a cobalt ring, a dotted Wash Blue inner ring and a tulip painted in four blues. It is the brand's one illustration, used on splash, welcome, onboarding and empty states. On the splash it rises and fades in over 700ms.

## Do's and Don'ts

### Do:
- **Do** use the CSS custom properties (`var(--primary)`, `var(--space-5)`, `var(--radius-card)`) rather than literal values; they are the contract with Figma.
- **Do** put one primary action per screen, full width, at the bottom in the dock.
- **Do** set Dutch words in Spectral and always show their `de`/`het` chip with them.
- **Do** give every animation a `prefers-reduced-motion` fallback, using the motion tokens (`--motion-fast` 120ms to `--motion-flip` 480ms, `--ease-standard` by default).
- **Do** tint shadows with navy or the element's own colour.
- **Do** keep tap targets at least 44px and text sizes in rem.

### Don't:
- **Don't** add a second brand accent; depth and emphasis come from the cobalt family.
- **Don't** use status colours (green, ochre, terracotta) as decoration.
- **Don't** use sharp corners or square buttons; tappable single-line controls are pills.
- **Don't** use grey or black shadows, or a solid opaque bar behind floating navigation.
- **Don't** set buttons, labels or inputs in the serif.
- **Don't** add new illustrations beside the tulip medallion and glyph, or redraw them; they are copied from the design file.
- **Don't** add a token only in code; create it in Figma first and run `npm run tokens`.
