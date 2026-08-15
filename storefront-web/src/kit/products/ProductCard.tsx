import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { Eye, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProductWishlistButton } from "@/components/products/ProductWishlistButton";
import { ProductThumb } from "@/components/products/ProductThumb";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { collectProductGalleryImages, resolveVariantThumbnailUrl } from "@/lib/productImageUtils";
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
import { CatalogVariantChips } from "@/components/catalog/CatalogVariantChips";
import { useCart, useCartVariantQty, useSetCatalogCartQty } from "@/hooks/useStore";
import { useVendor } from "@/contexts/VendorContext";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import { assertCanAddToCart, getEffectiveStockStatus, getMaxLineQuantity } from "@/lib/stockValidation";
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
    max_quantity_per_order: v.max_quantity_per_order,
    min_quantity_per_order: v.min_quantity_per_order,
    uom: v.uom,
    uom_quantity: v.uom_quantity,
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
  const realVariants = useMemo(
    () => allVariants.filter((v) => !String(v.id).endsWith("-default")),
    [allVariants],
  );
  const showFlatVariants = !showVariantRow && realVariants.length > 1;

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
  const [flatVariantId, setFlatVariantId] = useState<string | undefined>(realVariants[0]?.id);

  useEffect(() => {
    const nextFirst = allVariants.find((v) => v.available !== false) ?? allVariants[0];
    if (!nextFirst) return;
    const api = toApiVariant(nextFirst);
    const rows = buildProductCardOptionRows(apiVariants, galleryImages);
    const defaults = resolveCardDefaultSelections(apiVariants, rows, api);
    setSelections(defaults.selections);
    setSelectedColorName(defaults.colorName);
    setFlatVariantId(realVariants[0]?.id);
  }, [product.id]);

  const validation = useMemo(
    () => validateVariantCombination(apiVariants, selections, selectedColorName),
    [apiVariants, selections, selectedColorName],
  );

  const selectedVariant = useMemo(() => {
    if (showFlatVariants) {
      return realVariants.find((v) => v.id === flatVariantId) ?? firstAvailable;
    }
    if (optionRows.length === 0) return firstAvailable;
    if (!validation.valid || !validation.variant) return undefined;
    return allVariants.find((v) => v.id === validation.variant!.id);
  }, [allVariants, realVariants, validation, optionRows.length, firstAvailable, showFlatVariants, flatVariantId]);

  useCart();
  const cartQty = useCartVariantQty(
    product.id,
    selectedVariant?.id ?? (optionRows.length === 0 ? firstAvailable?.id : undefined),
  );
  const { setQty: setCatalogQty } = useSetCatalogCartQty();
  const { vendorSlug } = useVendor();
  const { isAuthenticated } = useAuthStore();

  const pricingVariant = useMemo(() => {
    if (showFlatVariants) return selectedVariant ?? firstAvailable;
    const match = resolveVariantForCardPricing(
      apiVariants,
      optionRows,
      selections,
      selectedColorName,
    );
    if (!match) return selectedVariant ?? undefined;
    return allVariants.find((v) => v.id === match.id) ?? selectedVariant;
  }, [apiVariants, optionRows, selections, selectedColorName, allVariants, firstAvailable, showFlatVariants, selectedVariant]);

  const displayPrice = pricingVariant?.price ?? product.price;
  const displayCompare = pricingVariant?.compareAtPrice ?? product.compareAtPrice;
  const variantPrices = allVariants.map((v) => v.price).filter((p): p is number => p != null && p > 0);
  const minPrice = variantPrices.length ? Math.min(...variantPrices) : displayPrice;
  const maxPrice = variantPrices.length ? Math.max(...variantPrices) : displayPrice;
  const hasDisplayPrice = displayPrice != null && Number(displayPrice) > 0;
  const showFrom =
    !!product.showFromPrice &&
    variantPrices.length > 1 &&
    minPrice !== maxPrice &&
    !pricingVariant &&
    optionRows.length === 0 &&
    !showFlatVariants;
  const showPriceRow = hasDisplayPrice || (showFrom && minPrice != null && minPrice > 0);

  const resolveAddVariant = () => {
    if (showFlatVariants) return selectedVariant;
    const resolved =
      validation.valid && validation.variant
        ? allVariants.find((v) => v.id === validation.variant!.id)
        : undefined;
    if (optionRows.length === 0) return resolved ?? selectedVariant ?? firstAvailable;
    return resolved ?? selectedVariant;
  };

  const stockVariant = resolveAddVariant();
  const outOfStock =
    (showVariantRow && !validation.valid) ||
    getEffectiveStockStatus(product, stockVariant) === "out_of_stock";
  const maxLineQty = getMaxLineQuantity({
    vendorSlug,
    isAuthenticated,
    productId: product.id,
    product,
    variant: stockVariant,
    currentLineQty: cartQty,
  });

  const canAdd =
    !addToCartPending &&
    !outOfStock &&
    (showFlatVariants
      ? selectedVariant != null
      : optionRows.length === 0
        ? firstAvailable != null
        : validation.valid && selectedVariant != null);

  const warnAtMaxQty = () => {
    const check = assertCanAddToCart({
      vendorSlug,
      isAuthenticated,
      productId: product.id,
      productName: product.name,
      product,
      variant: stockVariant,
      variantLabel: stockVariant?.label,
      requestQty: 1,
    });
    toast.error(
      check.ok
        ? "Maximum quantity reached — you cannot add more of this item."
        : check.message,
    );
  };

  const handleAddClick = () => {
    const variant = resolveAddVariant();
    if (!canAdd || !variant || !onAddToCart) return;
    void onAddToCart(product, variant);
  };

  const handleQtyChange = async (qty: number) => {
    const variant = resolveAddVariant();
    if (!variant) return;
    if (qty > cartQty) {
      const check = assertCanAddToCart({
        vendorSlug,
        isAuthenticated,
        productId: product.id,
        productName: product.name,
        product,
        variant,
        variantLabel: variant.label,
        requestQty: qty - cartQty,
      });
      if (!check.ok) {
        toast.error(check.message);
        return;
      }
    }
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

  const displayImage = useMemo(() => {
    const fromVariant = resolveVariantThumbnailUrl(selectedVariant ?? pricingVariant);
    const fromColor = resolveCardDisplayImage(optionRows, galleryImages, selectedColorName, product.image);
    return fromVariant ?? fromColor ?? product.image;
  }, [optionRows, galleryImages, selectedColorName, product.image, selectedVariant, pricingVariant]);

  const addLabel = outOfStock
    ? "Out of stock"
    : optionRows.length > 0 && !validation.valid
      ? "Select options"
      : undefined;

  return (
    <Card className={cn("overflow-hidden group flex flex-col", horizontal && "flex-row")}>
      <div className={cn("relative", horizontal ? "w-44 shrink-0" : "")}>
        <Link to={productHref} className="block" onClick={onNavigateClick}>
          <div className={cn("relative w-full overflow-hidden bg-muted", horizontal ? "h-full min-h-[7rem]" : "aspect-[4/3]")}>
            <ProductThumb
              src={displayImage}
              alt={product.name}
              size="md"
              className="absolute inset-0"
              imgClassName="object-contain object-center p-2"
            />
          </div>
        </Link>
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start pointer-events-none">
          {typeof product.viewCount === "number" && product.viewCount >= 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-black/55 backdrop-blur-sm text-white text-[11px] font-semibold px-2 py-0.5 shadow-sm"
              title={`${product.viewCount.toLocaleString()} views`}
            >
              <Eye className="h-3 w-3 shrink-0" aria-hidden />
              {product.viewCount.toLocaleString()}
            </span>
          )}
          {showTags && product.tags?.[0] && (
            <Badge className="capitalize">{product.tags[0]}</Badge>
          )}
        </div>
        {hasDisplayPrice && (displayCompare ?? 0) > displayPrice && (
          <Badge variant="destructive" className="absolute bottom-2 left-2 z-10 pointer-events-none">
            -{Math.round(((displayCompare! - displayPrice) / displayCompare!) * 100)}%
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
            product={product}
            onSelectSize={(dimension, value) => setSelections((prev) => ({ ...prev, [dimension]: value }))}
            onSelectColor={setSelectedColorName}
            errorMessage={validation.valid ? undefined : validation.message}
            stopPropagation
          />
        )}
        {showFlatVariants && (
          <CatalogVariantChips
            variants={apiVariants.filter((v) => !String(v.id).endsWith("-default"))}
            selectedId={selectedVariant?.id}
            onSelect={setFlatVariantId}
            productStock={product}
          />
        )}
        {showPriceRow ? (
          <div className="flex flex-wrap items-baseline gap-2">
            {showFrom && <span className="text-xs font-normal text-muted-foreground">From</span>}
            <span className="font-semibold">{formatPrice(showFrom ? minPrice : displayPrice, product.currency)}</span>
            {hasDisplayPrice && (displayCompare ?? 0) > displayPrice && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(displayCompare!, product.currency)}
              </span>
            )}
          </div>
        ) : (
          <div className="min-h-[1.25rem]" aria-hidden />
        )}
        <span
          className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full inline-block w-fit",
            outOfStock ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600",
          )}
        >
          {outOfStock ? "Out of Stock" : "In Stock"}
        </span>
        <div className={cn("mt-auto flex items-center gap-2 pt-2", !cardLayout.showAddButton && "hidden")}>
          {cardLayout.showAddButton && (
            <CatalogAddOrQtyControl
              cartQty={cartQty}
              onAdd={handleAddClick}
              onQtyChange={handleQtyChange}
              maxQty={maxLineQty}
              onAtMax={warnAtMaxQty}
              disabled={!canAdd && cartQty === 0}
              pending={addToCartPending}
              outOfStock={outOfStock}
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
