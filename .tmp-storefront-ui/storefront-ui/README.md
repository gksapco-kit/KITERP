# Storefront UI Templates (Lovable export)

Trendy, editorial storefront templates for an ERP store-front selector.

## Verticals
- **Retail (Atelier)** — Home, Shop, Product detail
- **Restaurant (Verde)** — Home, Menu, Reserve
- **Hospital (Solace)** — Home, Services, 3-step booking

## Stack
React 18 + Vite + TypeScript + Tailwind CSS v3 + shadcn/ui + react-router-dom + framer-motion (optional) + lucide-react.

## Folder map (drop into your project)
- `pages/` → `src/pages/`
- `components/site/` → `src/components/site/`
- `assets/` → `src/assets/`
- `styles/index.css` → replace/merge `src/index.css`
- `tailwind.config.ts` → merge into your tailwind config
- `App.tsx` → routing reference

## Routes
- `/` Gallery
- `/retail`, `/retail/shop`, `/retail/product/:id`
- `/restaurant`, `/restaurant/menu`, `/restaurant/reserve`
- `/hospital`, `/hospital/services`, `/hospital/book`

## Theming
Theme tokens (HSL) in `styles/index.css`:
- Retail: `--retail-bg/ink/accent`
- Restaurant: `--resto-bg/ink/accent`
- Hospital: `--hosp-bg/ink/accent`

All buttons are UI-only and currently fire toast notifications — wire them to your ERP endpoints.
