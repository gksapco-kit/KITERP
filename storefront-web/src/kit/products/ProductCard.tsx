import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { Star, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProductWishlistButton } from "@/components/products/ProductWishlistButton";
import { Card, CardContent } from "@/components/ui/card";
import { cn, imgUrl } from "@/lib/utils";
import { collectProductGalleryImages } from "@/lib/productImageUtils";
import type { ProductVariant as ApiVariant } from "@/types";
import ProductOptionPicker from "@/components/products/ProductOptionPicker";
import {
  buildProductCardOptionRows,
  resolveCardDefaultSelections,
  resolveCardDisplayImage,
  resolveVariantForCardPricing,
  validateVariantCombination,
} from "@/lib/variantOptions";
import {
  readCatalogCardLayout,
} from "@/lib/catalogCardLayout";
import { CatalogAddOrQtyControl } from "@/components/catalog/CatalogAddOrQtyControl";
import { useCart, useCartVariantQty, useSetCatalogCartQty } from "@/hooks/useStore";
import type { Product } from "../types";
import { formatPrice } from "../mock";

type KitVariant = NonNullable<Product["variants"]>[number];

export interface ProductCardProps {
  product: Product;
  layout?: "vertical" | "horizontal";
  showRating?: boolean;
  showTags?: boolean;
  /** Override card link target (e.g. branch-aware cart detail view). */
  linkTo?: string;
  onNavigateClick?: (e: MouseEvent) => void;
  onAddToCart?: (p: Product, variant?: KitVariant) => void | Promise<void>;
  onToggleWishlist?: (p: Product) => void;
  addToCartPending?: boolean;
}

function toApiVariant(v: KitVariant): ApiVariant {
  return {
    id: v.id,
    name: v.label,
    price: v.price ?? 0,
    color: v.color,
    attributes: v.attributes,
    media: v.media,
    quantity: v.quantity,
    track_inventory: v.track_inventory,
    allow_backorders: v.allow_backorders,
    stock_status: v.stock_status,
  };
}

export function ProductCard({
  product,
  layout = "vertical",
  showRating = true,
  showTags = true,
  linkTo,
  onNavigateClick,
  onAddToCart,
  onToggleWishlist,
  addToCartPending = false,
}: ProductCardProps) {
  const cardLayout = readCatalogCardLayout({});
  const productHref = linkTo ?? `/products/${product.slug}`;
  const horizontal = layout === "horizontal";
  const allVariants = product.variants ?? [];
  const apiVariants = useMemo(() => allVariants.map(toApiVariant), [allVariants]);
  const galleryImages = useMemo(() => {
    const productImages = product.images?.length
      ? product.images.map((img) =>
          typeof img === "string" ? { url: img } : { url: img.url, alt_text: img.alt_text },
        )
      : product.image
        ? [{ url: product.image }]
        : []
    return collectProductGalleryImages({
      images: productImages,
      variants: apiVariants,
    })
  }, [product.images, product.image, apiVariants]);
  const optionRows = useMemo(
    () => buildProductCardOptionRows(apiVariants, galleryImages),
    [apiVariants, galleryImages],
  );
  const showVariantRow = optionRows.length > 0;

  const firstAvailable = allVariants.find((v) => v.available !== false) ?? allVariants[0];
  const firstApi = firstAvailable ? toApiVariant(firstAvailable) : undefined;

  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const defaults = resolveCardDefaultSelections(apiVariants, optionRows, firstApi);
    return defaults.selections;
  });
  const [selectedColorName, setSelectedColorName] = useState<string | undefined>(() => {
    const defaults = resolveCardDefaultSelections(apiVariants, optionRows, firstApi);
    return defaults.colorName;
  });

  useEffect(() => {
    const nextFirst = allVariants.find((v) => v.available !== false) ?? allVariants[0];
    if (!nextFirst) return;
    const api = toApiVariant(nextFirst);
    const rows = buildProductCardOptionRows(apiVariants, galleryImages);
    const defaults = resolveCardDefaultSelections(apiVariants, rows, api);
    setSelections(defaults.selections);
    setSelectedColorName(defaults.colorName);
  }, [product.id]);

  const validation = useMemo(
    () => validateVariantCombination(apiVariants, selections, selectedColorName),
    [apiVariants, selections, selectedColorName],
  );

  const selectedVariant = useMemo(() => {
    if (optionRows.length === 0) return firstAvailable;
    if (!validation.valid || !validation.variant) return undefined;
    return allVariants.find((v) => v.id === validation.variant!.id);
  }, [allVariants, validation, optionRows.length, firstAvailable]);

  useCart();
  const cartQty = useCartVariantQty(
    product.id,
    selectedVariant?.id ?? (optionRows.length === 0 ? firstAvailable?.id : undefined),
  );
  const { setQty: setCatalogQty } = useSetCatalogCartQty();

  const pricingVariant = useMemo(() => {
    const match = resolveVariantForCardPricing(
      apiVariants,
      optionRows,
      selections,
      selectedColorName,
    );
    if (!match) return firstAvailable;
    return allVariants.find((v) => v.id === match.id) ?? firstAvailable;
  }, [apiVariants, optionRows, selections, selectedColorName, allVariants, firstAvailable]);

  const displayPrice = pricingVariant?.price ?? product.price;
  const displayCompare = pricingVariant?.compareAtPrice ?? product.compareAtPrice;
  const variantPrices = allVariants.map((v) => v.price).filter((p): p is number => p != null);
  const minPrice = variantPrices.length ? Math.min(...variantPrices) : displayPrice;
  const maxPrice = variantPrices.length ? Math.max(...variantPrices) : displayPrice;
  const showFrom =
    !!product.showFromPrice && minPrice !== maxPrice && !pricingVariant && optionRows.length === 0;
  const canAdd =
    !addToCartPending &&
    (optionRows.length === 0
      ? firstAvailable?.available !== false && product.inStock
      : validation.valid && selectedVariant?.available !== false && product.inStock);

  const displayImage = useMemo(
    () =>
      resolveCardDisplayImage(optionRows, galleryImages, selectedColorName, product.image) ??
      product.image,
    [optionRows, galleryImages, selectedColorName, product.image],
  );

  const resolveAddVariant = () => {
    const resolved =
      validation.valid && validation.variant
        ? allVariants.find((v) => v.id === validation.variant!.id)
        : undefined;
    return resolved ?? selectedVariant ?? firstAvailable;
  };

  const handleAddClick = () => {
    const variant = resolveAddVariant();
    if (!canAdd || !variant || !onAddToCart) return;
    void onAddToCart(product, variant);
  };

  const handleQtyChange = async (qty: number) => {
    const variant = resolveAddVariant();
    if (!variant) return;
    await setCatalogQty({
      productId: product.id,
      variantId: variant.id,
      qty,
      addItem: {
        product_id: product.id,
        variant_id: variant.id,
        name: product.name,
        qty: 1,
        price: variant.price ?? product.price,
        image_url: displayImage,
      },
    });
  };

  const addLabel = !product.inStock
    ? "Out of stock"
    : optionRows.length > 0 && !validation.valid
      ? "Select options"
      : (selectedVariant ?? firstAvailable)?.available === false
        ? "Out of stock"
        : undefined;

  return (
    <Card className={cn("overflow-hidden group flex flex-col", horizontal && "flex-row")}>
      <div className={cn("relative", horizontal ? "w-44 shrink-0" : "")}>
        <Link to={productHref} className="block" onClick={onNavigateClick}>
          <div className={cn("relative w-full overflow-hidden bg-muted", horizontal ? "h-full" : "aspect-[4/3]")}>
            {displayImage ? (
              <img
                key={displayImage}
                src={imgUrl(displayImage)}
                alt={product.name}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <ShoppingCart className="h-8 w-8 opacity-25" />
              </div>
            )}
          </div>
        </Link>
        {showTags && product.tags?.[0] && (
          <Badge className="absolute top-2 left-2 z-10 capitalize pointer-events-none">{product.tags[0]}</Badge>
        )}
        {displayCompare && displayCompare > displayPrice && (
          <Badge variant="destructive" className="absolute bottom-2 left-2 z-10 pointer-events-none">
            -{Math.round(((displayCompare - displayPrice) / displayCompare) * 100)}%
          </Badge>
        )}
        <div className="absolute top-3 right-3 z-20">
          <ProductWishlistButton
            productId={product.id}
            productName={product.name}
            slug={product.slug}
            price={displayPrice}
            imageUrl={displayImage}
            variantId={selectedVariant?.id}
            overlay
            className="h-9 w-9 rounded-lg"
          />
        </div>
      </div>
      <CardContent className={cn("flex flex-1 flex-col gap-2 p-4", horizontal && "p-4")}>
        <Link to={productHref} className="font-medium line-clamp-2 no-underline hover:no-underline" onClick={onNavigateClick}>
          {product.name}
        </Link>
        {showRating && product.rating && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-current text-yellow-500" />
            {product.rating.toFixed(1)} <span>({product.reviewCount})</span>
          </div>
        )}
        {showVariantRow && (
          <ProductOptionPicker
            rows={optionRows}
            selections={selections}
            selectedColorName={selectedColorName}
            selectedVariantId={validation.variant?.id ?? selectedVariant?.id}
            variants={apiVariants}
            onSelectSize={(dimension, value) => setSelections((prev) => ({ ...prev, [dimension]: value }))}
            onSelectColor={setSelectedColorName}
            errorMessage={validation.valid ? undefined : validation.message}
            stopPropagation
          />
        )}
        <div className="flex flex-wrap items-baseline gap-2">
          {showFrom && <span className="text-xs font-normal text-muted-foreground">From</span>}
          <span className="font-semibold">{formatPrice(displayPrice, product.currency)}</span>
          {displayCompare && displayCompare > displayPrice && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(displayCompare, product.currency)}
            </span>
          )}
        </div>
        <div className={cn("mt-auto flex items-center gap-2 pt-2", !cardLayout.showAddButton && "hidden")}>
          {cardLayout.showAddButton && (
            <CatalogAddOrQtyControl
              cartQty={cartQty}
              onAdd={handleAddClick}
              onQtyChange={handleQtyChange}
              disabled={!canAdd && cartQty === 0}
              pending={addToCartPending}
              outOfStock={!product.inStock || (selectedVariant ?? firstAvailable)?.available === false}
              labelOverride={addLabel}
              addButtonStyle={cardLayout.addButtonStyle}
              isMinimalCard={cardLayout.isMinimalCard}
              isCompactCard={cardLayout.isCompactCard}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export interface ProductGridProps {
  products: Product[];
  columns?: 2 | 3 | 4 | 5;
  onAddToCart?: (p: Product, variant?: KitVariant) => void;
  onToggleWishlist?: (p: Product) => void;
}

export function ProductGrid({ products, columns = 4, onAddToCart, onToggleWishlist }: ProductGridProps) {
  const colMap: Record<number, string> = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
    5: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  };
  return (
    <div className={cn("grid grid-cols-1 gap-4", colMap[columns])}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} onAddToCart={onAddToCart} onToggleWishlist={onToggleWishlist} />
      ))}
    </div>
  );
}

export function ProductList({ products, onAddToCart }: { products: Product[]; onAddToCart?: (p: Product, variant?: KitVariant) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} layout="horizontal" onAddToCart={onAddToCart} />
      ))}
    </div>
  );
}
