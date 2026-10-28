# Design System

Recorded from `app/globals.css`, `app/layout.tsx` and the CSS modules in `app/` and `components/`. These are the values in use.

## 01 Brand Identity
Focused, dark, technical, calm.

## 02 Colour Palette
| Name | Hex | Use for |
|---|---|---|
| Background (`--background`) | #080b11 | Page background |
| Foreground (`--foreground`) | #e4e7ec | Main text |
| Teal accent | #6de3d5 | Primary actions, active states, focus |
| Mint | #8adbc7 | Secondary accents, cited evidence |
| Success | #6ee7b7 / #a7f3d0 | Correct answers, success notices |
| Slate text | #cbd5e1 / #e2e8f0 | Body text on panels |
| Muted | #8fa8b5 / #9fbac5 | Secondary text, labels |
| Border slate | #475569 | Borders, dividers |
| Amber | #7d6439 | Hints and warnings |

## 03 Typography
- **Font:** Geist (sans), Geist Mono for commands and evidence output
- **UI text:** 12–13px (most common), labels 10–11px, headings 14–18px; landing hero larger
- Command and log output always in Geist Mono

## 04 Spacing
- Common steps: 4, 8, 12, 16, 24, 32px
- Content stays readable: evidence panes scroll rather than widen the page

## 05 Border Radius
- Buttons and inputs: 5–6px
- Cards and panels: 7–8px; larger panels 10px

## 06 Components
- **Primary button:** teal accent background, dark text
- **Evidence item:** monospace output with an explicit "cite" toggle
- **Feedback:** option-specific messages; hints are progressive and labelled
- **Focus:** visible outline on every interactive element; keyboard paths are tested in CI with axe

## 07 Icons
Inline SVG components in `components/Icons.tsx`, `currentColor`.

## 08 Breakpoints
- ≤1000px / ≤980px: workbench columns stack
- ≤760px: tablet layout
- ≤560px: phone layout
- `prefers-reduced-motion`: animations off

## Rules
- Never use colours outside this palette
- Every page must work at 375px width
- Cases and evidence are labelled synthetic
