# Design system — Polymarket AI Widget

## Mode
Operate (trading desk). Scanability and task clarity beat decorative expression.

## Scene
Cool evening monitor light — deep ink canvas, soft slate panels, one mint accent for affirmative actions.
Background is a solid canvas only (no radial washes) to avoid banding on scroll.

## Color strategy
Restrained neutrals + semantic accents.
- Canvas: `#07111f`
- Panel: `#0e1a2b`
- Line: `#1c2d45`
- Text: `#e8eef7` / muted `#93a4bd`
- Yes / success: `#2dd4a8`
- No / danger: `#f07167`
- Accent (primary CTA): `#3d8bfd`
- Focus ring: `#3d8bfd` at 40%

## Type
- UI + data: `Geist` (Next default) — single family, tabular nums for prices.
- Scale: 12 / 14 / 16 / 20 / 28 (rem steps, fixed).

## Components
- Markets render as interaction tiles (Polymarket-like board): image, question, chance bar, Yes/No actions, volume, schedule.
- Cards are allowed only as market/opportunity containers for action — no nested chrome.
- Modals for AI advice, opportunity scout, bet confirmation, and position management.
- Dialog measure: default ~440px; opportunities scout ~34rem max (Operate reading column). Never stretch tool modals to board width.
- Skeleton tiles for loading; empty state teaches search.
- Buttons share one radius (10px) and weight vocabulary.

## Motion
150–220ms ease-out on hover/open. Highlight flash after placing a paper bet. No page-load choreography.

## Anti-references
Purple-on-white AI gradients, cream+terracotta editorial, broadsheet hairlines, emoji-as-icons, glassmorphism stacks.
