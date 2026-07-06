import { mockCategories } from "@/commerce-blocks/mock/products";
import type { ReactNode } from "react";
import { cn, imgUrl } from "@/lib/utils";
import { buildCategoryCatalogPath } from "@/lib/categoryCatalogLink";
import { useStorePath } from "@/hooks/useStorePath";
import { Link } from "react-router-dom";
import {
  catalogGridClassName,
  type CategoryShowcaseLayout,
} from "@/lib/commerceCatalogLayout";

interface Props {
  layout?: CategoryShowcaseLayout | string;
  showCount?: boolean;
  title?: string;
  columns?: number;
  gap?: number;
  imageHeightPct?: number;
  itemLimit?: number;
  bg_style?: string;
}

type CategoryItem = {
  id: string;
  name: string;
  count: number;
  image?: string;
  appliesTo?: string;
};

function CategoryTileLink({
  item,
  children,
  className,
}: {
  item: CategoryItem;
  children: ReactNode;
  className?: string;
}) {
  const storePath = useStorePath();
  const to = buildCategoryCatalogPath(item.name, item.appliesTo, storePath);
  return (
    <Link to={to} className={cn("block no-underline text-inherit", className)}>
      {children}
    </Link>
  );
}

function CategoryTile({
  item,
  showCount,
  imagePad,
  className,
  titleClass = "text-lg font-semibold",
  overlay = "gradient",
}: {
  item: CategoryItem;
  showCount: boolean;
  imagePad: number;
  className?: string;
  titleClass?: string;
  overlay?: "gradient" | "dark" | "none";
}) {
  const image = item.image ? imgUrl(item.image) : undefined;
  return (
    <div
      className={cn(
        "builder-tile-card group relative cursor-pointer overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
    >
      <div className="relative w-full bg-muted" style={{ paddingBottom: `${imagePad}%` }}>
        {image ? (
          <img
            src={image}
            alt={item.name}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 bg-muted" />
        )}
        {overlay === "gradient" && (
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/10 to-transparent" />
        )}
        {overlay === "dark" && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
        )}
        <div className="absolute inset-x-0 bottom-0 p-4 text-background">
          <div className={titleClass}>{item.name}</div>
          {showCount && (
            <div className="text-xs opacity-90">
              {item.count} product{item.count === 1 ? "" : "s"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CategoryShowcase({
  layout = "grid",
  showCount = true,
  title = "Shop by category",
  columns = 4,
  gap = 16,
  imageHeightPct = 100,
  itemLimit,
  bg_style,
}: Props) {
  const mode = String(layout) as CategoryShowcaseLayout;
  const items = mockCategories.slice(0, itemLimit ?? mockCategories.length);
  const gridClass = catalogGridClassName(columns, "category_cards");
  const imagePad = Math.min(150, Math.max(50, imageHeightPct));
  const isDark = bg_style === "dark";
  const sectionClass = cn("px-6 py-10", isDark && "bg-gray-900 text-white");
  const headingClass = cn(
    "mb-6 text-2xl font-semibold tracking-tight",
    isDark && "text-white",
  );

  if (items.length === 0) {
    return (
      <section className={sectionClass}>
        {title && <h2 className={headingClass}>{title}</h2>}
        <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
          No categories yet. Add categories in Sales → Categories to populate this section.
        </div>
      </section>
    );
  }

  if (mode === "list") {
    return (
      <section className={sectionClass}>
        {title && <h2 className={headingClass}>{title}</h2>}
        <div className="mx-auto max-w-2xl divide-y" style={{ borderColor: isDark ? "#374151" : undefined }}>
          {items.map((c) => (
            <CategoryTileLink key={c.id} item={c}>
              <div className="flex items-center justify-between gap-4 py-4">
                <span className={cn("text-base font-medium", isDark ? "text-white" : "text-foreground")}>
                  {c.name}
                </span>
                {showCount && (
                  <span className={cn("text-sm shrink-0", isDark ? "text-gray-400" : "text-muted-foreground")}>
                    {c.count} →
                  </span>
                )}
              </div>
            </CategoryTileLink>
          ))}
        </div>
      </section>
    );
  }

  if (mode === "carousel" || mode === "strip") {
    const tileWidth = mode === "strip" ? "w-40 shrink-0" : "w-56 shrink-0";
    const stripPad = mode === "strip" ? Math.min(100, imagePad * 0.85) : imagePad;
    return (
      <section className={sectionClass}>
        {title && <h2 className={headingClass}>{title}</h2>}
        <div className="flex overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory" style={{ gap }}>
          {items.map((c) => (
            <CategoryTileLink key={c.id} item={c} className={cn(tileWidth, "snap-start")}>
              <CategoryTile
                item={c}
                showCount={showCount}
                imagePad={stripPad}
                className="h-full"
                titleClass={mode === "strip" ? "text-sm font-semibold" : "text-lg font-semibold"}
              />
            </CategoryTileLink>
          ))}
        </div>
      </section>
    );
  }

  if (mode === "banner") {
    const bannerCols = columns <= 2 ? 2 : Math.min(columns, 3);
    const bannerClass = catalogGridClassName(bannerCols, "category_cards");
    return (
      <section className={sectionClass}>
        {title && <h2 className={headingClass}>{title}</h2>}
        <div className={cn("grid", bannerClass)} style={{ gap }}>
          {items.map((c) => (
            <CategoryTileLink key={c.id} item={c}>
              <CategoryTile
                item={c}
                showCount={showCount}
                imagePad={Math.max(45, imagePad * 0.55)}
                titleClass="text-xl sm:text-2xl font-semibold"
                overlay="dark"
              />
            </CategoryTileLink>
          ))}
        </div>
      </section>
    );
  }

  if (mode === "overlay") {
    return (
      <section className={sectionClass}>
        {title && <h2 className={headingClass}>{title}</h2>}
        <div className={cn("grid", gridClass)} style={{ gap }}>
          {items.map((c) => (
            <CategoryTileLink key={c.id} item={c}>
              <CategoryTile
                item={c}
                showCount={showCount}
                imagePad={Math.max(90, imagePad * 1.1)}
                titleClass="text-xl font-semibold"
                overlay="dark"
              />
            </CategoryTileLink>
          ))}
        </div>
      </section>
    );
  }

  if (mode === "compact") {
    const compactClass = catalogGridClassName(Math.max(columns, 5), "category_cards");
    return (
      <section className={sectionClass}>
        {title && <h2 className={headingClass}>{title}</h2>}
        <div className={cn("grid", compactClass)} style={{ gap: Math.min(gap, 12) }}>
          {items.map((c) => (
            <CategoryTileLink key={c.id} item={c}>
              <CategoryTile
                item={c}
                showCount={showCount}
                imagePad={Math.min(85, imagePad * 0.75)}
                titleClass="text-sm font-semibold"
              />
            </CategoryTileLink>
          ))}
        </div>
      </section>
    );
  }

  // Default grid
  return (
    <section className={sectionClass}>
      {title && <h2 className={headingClass}>{title}</h2>}
      <div className={cn("grid", gridClass)} style={{ gap }}>
        {items.map((c) => (
          <CategoryTileLink key={c.id} item={c}>
            <CategoryTile
              item={c}
              showCount={showCount}
              imagePad={imagePad}
            />
          </CategoryTileLink>
        ))}
      </div>
    </section>
  );
}
