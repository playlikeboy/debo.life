# DESIGN.md

How Debo looks, moves and feels. The landing page in `apps/web` is the reference. Tokens live in `apps/web/src/app/globals.css`.

## The feeling

Debo should feel like a small, kind friend who keeps your things safe. Two words guide every choice: **cute** and **trustworthy**. When they pull apart, trustworthy wins.

- Cute comes from Debo itself (the mascot), soft shapes and a warm voice.
- Trust comes from calm layouts, plain words, strong contrast and showing sources.
- Never cute at the cost of clarity. No baby talk, no emoji walls, no confetti.

## Debo, the mascot

A round, butter-yellow character with two eyes, small cheeks and a soft smile. Drawn in SVG, no image files.

- Its eyes follow the pointer. This is the one playful moment on a screen. Do not add a second.
- Debo appears once per screen at most. It is a character, not a pattern.
- Debo never looks sad, angry or shocked at the person. When something fails, Debo stays calm.
- Do not give Debo a human face, body or gender.

## Colour

| Token | Hex | Use |
|---|---|---|
| `--color-sky` | `#E9EEFF` | Page background |
| `--color-paper` | `#FFFFFF` | Surfaces that hold a person's own content |
| `--color-ink` | `#1B1F4B` | All text, outlines, primary buttons |
| `--color-ink-soft` | `#4A4F7A` | Secondary text |
| `--color-butter` | `#FFD23F` | Debo, and nothing bigger than Debo |
| `--color-mint` | `#C4F1DA` | "You are in control" moments: sources, permissions, saved |
| `--color-blush` | `#FFB3C7` | Debo's cheeks, small highlights only |
| `--color-line` | `#C9D0F2` | Quiet borders |

Rules:

- Ink on sky, paper, butter and mint all pass WCAG AA for body text. Never put white text on butter, mint or blush.
- Butter belongs to Debo. Do not use it for buttons, banners or backgrounds.
- Mint means the person is in control. Do not use it as decoration.
- No gradients, no glows, no glass effects.
- Danger actions use ink with clear words ("Delete this memory"), not a red page.

## Type

| Role | Family | Notes |
|---|---|---|
| Headings | Bricolage Grotesque Variable | Weight 700, tight line height (1.05), slight negative tracking |
| Body and UI | Figtree Variable | Weight 400 and 600, line height 1.6 |

- Both are self-hosted through `@fontsource-variable/*`. No requests to a font service.
- Scale: 16, 18, 22, 28, 40, 56, 76 px. Do not add sizes in between.
- Body text never smaller than 16px. Lines no longer than about 65 characters.
- Sentence case. No all-caps. No italic for emphasis; use weight 600.

## Shape and space

- Radius: 12px for inputs and chips, 24px for panels, full pill for buttons. Debo is the only circle.
- Outlines: 2px ink on things a person can press. 1px `--color-line` on things they only read.
- Shadows: one hard offset shadow, `4px 4px 0 var(--color-ink)`, only on the primary button and the answer card. Nothing else gets a shadow.
- Spacing steps: 4, 8, 12, 16, 24, 32, 48, 72, 112 px.
- Left-align text. Centre only very short lines.
- Content width max 1120px, with 20px side padding on phones.

## Motion

- Debo's eyes follow the pointer. Debo blinks now and then.
- Things a person opens or closes may animate for 150 to 200ms.
- Nothing fades or slides in on scroll.
- With `prefers-reduced-motion`, all motion stops and Debo's eyes rest in the centre.

## Patterns that carry trust

Build these the same way everywhere.

**Answer with sources.** Every answer from Debo ends with small mint chips, one per source, each saying what it is and when ("Journal, 14 March"). Pressing a chip opens the original. An answer with no source is not allowed; Debo says "I don't have anything about that yet."

**Memory card.** One thing Debo knows, in one sentence, with where it learned it, and two actions: "Fix this" and "Forget this".

**Permission ask.** Before Debo reads from a new place or does something outside Debo: what it wants, why, and two equal buttons. "Not now" is never smaller or greyer than "Allow".

**Activity record.** A plain list of what Debo read and did, newest first. No hiding, no "advanced" tab.

**Status label.** Anything planned but not built is labelled "Coming later". Never show a feature as live when it is not.

## Accessibility floor

- WCAG 2.1 AA contrast everywhere.
- Every action works with a keyboard. Focus ring: 3px ink outline with 3px offset.
- Touch targets at least 44 by 44px.
- Every input has a visible label. Placeholder text is not a label.
- Meaning never depends on colour alone.
- The mascot is decorative: `aria-hidden="true"`.

## Do not

- No dark mode until the light theme is finished and tested. Then design it on purpose.
- No stock photos, no AI-made illustrations of people.
- No fake chat bubbles pretending to be real users.
- No more than one primary button on a screen.
