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
  buildCatalogImageShell,
  readCatalogCardLayout,
  resolveCardRadiusPresentation,
  type CatalogCardLayout,
  type CatalogImageObjectFit,
} from "@/lib/catalogCardLayout";
import { catalogTileImageWrapperClass, type ImageShape } from "@/lib/sectionItemLayout";
import { CatalogAddOrQtyControl } from "@/components/catalog/CatalogAddOrQtyControl";
import { CatalogVariantChips } from "@/components/catalog/CatalogVariantChips";
import { useCart, useCartVariantQty, useSetCatalogCartQty } from "@/hooks/useStore";
import { useVendor } from "@/contexts/VendorContext";
import { isDisplayFieldEnabled } from "@/lib/storefrontDisplayFields";
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
  /** How the product photo fills the square frame. Default contain so pack-shot text is not cropped. */
  imageObjectFit?: CatalogImageObjectFit;
  /** Website-builder / section card layout — applied immediately on the selected grid. */
  cardLayout?: CatalogCardLayout;
  /** Tile image shape from the section Layout tab (Arch, Circle, …). */
  imageShape?: ImageShape;
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
  imageObjectFit = "contain",
  cardLayout: cardLayoutProp,
  imageShape,
  onNavigateClick,
  onAddToCart,
  onToggleWishlist,
  addToCartPending = false,
}: ProductCardProps) {
  const cardLayout = cardLayoutProp ?? readCatalogCardLayout({});
  const imageFit = cardLayoutProp?.imageObjectFit ?? imageObjectFit;
  const productTileWrap = imageShape ? catalogTileImageWrapperClass(imageShape) : "";
  const isCircleTile = imageShape === "circle";
  const imageShell = buildCatalogImageShell({
    imageHeightPct: cardLayout.imageHeightPct,
    imageWidthPct: cardLayout.imageWidthPct,
    imageAspect: cardLayoutProp?.imageAspect ?? (isCircleTile ? "square" : "auto"),
    imageObjectFit: imageFit,
    imageObjectPosition: cardLayout.imageObjectPosition,
    imageZoom: cardLayout.imageZoom,
    productTileWrap,
    isCircle: isCircleTile,
    bgClass: "bg-white",
  });
  const cardRadiusPresentation = cardLayoutProp
    ? resolveCardRadiusPresentation(cardLayout.cardBorderRadius, cardLayout.cardRadius)
    : null;
  const cardRadiusStyle = cardLayoutProp
    ? (cardRadiusPresentation?.style ?? {
        borderRadius: cardLayout.isMinimalCard ? 8 : cardLayout.isCompactCard ? 12 : 16,
      })
    : undefined;
  const { displayFields } = useVendor();
  const showViewCount = isDisplayFieldEnabled(displayFields.product, "view_count");
  const showWishlist = isDisplayFieldEnabled(displayFields.product, "wishlist");
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
    stockVariant != null &&
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
    <Card
      className={cn(
        "overflow-hidden group flex flex-col",
        horizontal && "flex-row",
        cardRadiusPresentation?.className,
      )}
      style={cardRadiusStyle}
    >
      <div className={cn("relative", horizontal ? "w-44 shrink-0" : "")}>
        <Link to={productHref} className="block" onClick={onNavigateClick}>
          <div
            className={cn(
              imageShell.wrapperClassName,
              horizontal && "h-full min-h-[7rem]",
            )}
            style={imageShell.wrapperStyle}
          >
            <ProductThumb
              src={displayImage}
              alt={product.name}
              size="md"
              className={imageShell.intrinsic ? "relative block h-auto w-full bg-white" : "absolute inset-0 bg-white"}
              imgClassName={imageShell.imageClassName}
              imgStyle={imageShell.imageStyle}
            />
          </div>
        </Link>
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start pointer-events-none">
          {showViewCount && typeof product.viewCount === "number" && product.viewCount > 0 && (
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
        {showWishlist && (
          <div className="absolute top-2 right-2 z-20">
            <ProductWishlistButton
              productId={product.id}
              productName={product.name}
              slug={product.slug}
              price={displayPrice}
              imageUrl={displayImage}
              variantId={selectedVariant?.id}
              overlay
              className="h-7 w-7 rounded-md"
            />
          </div>
        )}
      </div>
      <CardContent
        className={cn("flex flex-1 flex-col gap-1", horizontal ? "p-3" : cardLayoutProp ? "p-0" : "p-2.5")}
        style={cardLayoutProp ? { padding: cardLayout.cardPadding } : undefined}
      >
        <Link to={productHref} className="text-sm font-semibold leading-snug line-clamp-2 no-underline hover:no-underline" onClick={onNavigateClick}>
          {product.name}
        </Link>
        {showRating && (product.rating ?? 0) > 0 && (
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
            compact
          />
        )}
        {showFlatVariants && (
          <CatalogVariantChips
            variants={apiVariants.filter((v) => !String(v.id).endsWith("-default"))}
            selectedId={selectedVariant?.id}
            onSelect={setFlatVariantId}
            productStock={product}
            className="mt-0.5"
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
          {showPriceRow ? (
            <div className="flex flex-wrap items-baseline gap-1.5">
              {showFrom && <span className="text-xs font-normal text-muted-foreground">From</span>}
              <span className="text-sm font-semibold">{formatPrice(showFrom ? minPrice : displayPrice, product.currency)}</span>
              {hasDisplayPrice && (displayCompare ?? 0) > displayPrice && (
                <span className="text-xs text-muted-foreground line-through">
                  {formatPrice(displayCompare!, product.currency)}
                </span>
              )}
            </div>
          ) : (
            <span />
          )}
          <span
            className={cn(
              "text-[10px] font-semibold px-1.5 py-px rounded-full inline-block w-fit",
              outOfStock ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600",
            )}
          >
            {outOfStock ? "Out of Stock" : "In Stock"}
          </span>
        </div>
        <div className={cn("mt-auto flex items-center gap-2 pt-1", !cardLayout.showAddButton && "hidden")}>
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
              isCompactCard
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
    <div className={cn("grid grid-cols-1 gap-2.5", colMap[columns])}>
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
