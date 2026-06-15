# Apex

Internal tool for beverage/alcohol catalog support. Produces a precisely formatted cross-reference table — with real merged cells — copyable directly into Google Sheets, Excel, Gmail, or Zendesk rich text.

## Install & run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build
npm test           # run unit tests (21 tests)
```

## How it works

### Three zones

**Zone A — Request Setup (left rail)**  
Enter supplier name and distributor. Both persist across sessions with autocomplete from history. Distributor name + ID are used in the "Copy Full Email" output only, not the table.

**Zone B — Items Input (center)**  
Add brand blocks with `+ Add brand`. Each block has a brand name field and a textarea for raw item strings, one per line. Or switch to **Bulk Paste** mode and use the format:
```
Brand: Champagne Jacquart
jacquart blanc de blancs 1/12B/750mL
jacquart mosaique brut nv 1/12B/750mL

Brand: O'Driscolls
odriscolls irish whiskey 1/6B/750mL
```
Hit **Generate Table** or press `Ctrl+Enter` / `⌘+Enter` anywhere.

**Zone C — Output Table (right, hero)**  
Rendered as a real HTML table with merged cells. Click any cell to edit inline. Tab/Shift+Tab moves between cells. Amber-bordered cells have a warning (e.g. multiplier ≠ 1); red-bordered cells are missing a pack code.

### Copying

- **Copy Table** (`Ctrl+Shift+C`) — writes `text/html` (merged cells, Calibri 11pt, borders) + `text/plain` (TSV) to the clipboard simultaneously. Paste into Sheets, Excel, Gmail, or Zendesk and cells merge correctly.
- **Copy Full Email** — wraps the table in the standard email template addressed to the distributor.

### Brand Dictionary

The dictionary maps aliases → canonical brand names. Seeds: `jacquart → Champagne Jacquart`, `odriscolls → O'Driscolls`.

Every time you manually edit a brand name in the composer, the new value is learned (toast notification confirms). Access the full dictionary via **Brand Dictionary** button (top-right): view, delete entries, export/import JSON.

### Parser rules

Pack code format: `<multiplier>/<count><container>/<size><unit>`  
Examples: `1/12B/750mL`, `4/6C/12oz`, `1/3B/1.5L`

| Container | Output |
|-----------|--------|
| B | BTL |
| C | CN |
| K | KEG |
| G | GLS |

Package Size = `<multiplier × count>/<size> <UNIT> <CONTAINER>`  
Multiplier ≠ 1 → amber flag (verify the computed count).  
No pack code found → red flag, Package Size left blank.

Product Name strips leading brand alias tokens and title-cases the remainder. Special tokens: `nv→NV`, `vsop→VSOP`, `xo→XO`, minor words (`de`, `du`, `la`, `of`, …) stay lowercase unless first.

## Persistence

Everything autosaves to `localStorage` under key `apex-catalog-v1`. Clearing browser storage resets the app (brand dictionary seeds are restored automatically).
