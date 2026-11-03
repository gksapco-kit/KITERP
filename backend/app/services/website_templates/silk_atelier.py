"""
"Silk Atelier" - a premium boutique template for sarees, silks, bridal wear and jewellery.

Pure data, no network or DB. `build_silk_atelier_template()` returns a dict in the same shape as
the entries of `WEBSITE_TEMPLATES`, so it appears in the template gallery and, when applied,
creates every page below automatically:

    Home, New Arrivals, About, Contact, Returns, Shipping, Privacy Policy, Terms & Conditions

Everything is editable in the website builder: the premium sections have their own editor
(labels, links, images, product-category filters) and the shared header/footer live on Home.

Conventions
- "Your Brand" is replaced with the vendor's business name when the template is applied
  (see `brand_placeholder` below and `apply_template`).
- Product rows read the vendor's live catalog. `category_filter` matches against product
  category / brand / tags / title, so vendors only need to rename the tags to their own
  categories. Empty rows render a tasteful placeholder.
- Images ship with the backend (app/template_assets/silk_atelier) and are served from
  /uploads/template-assets/silk_atelier/<file>.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import quote, urlencode

TEMPLATE_ID = "silk_atelier"
BRAND = "Your Brand"

PRIMARY = "#5A0B3A"      # deep maroon / plum
SECONDARY = "#7A1650"    # raspberry
ACCENT = "#C9A04A"       # antique gold
HIGHLIGHT = "#9B1B6E"
CREAM = "#FBF5EA"
INK = "#3B1A2C"

_ASSET_BASE = "/uploads/template-assets/silk_atelier/"
_IMAGES = {
    "hero": "hero.jpg",
    "kanchipuram": "kanchipuram.jpg",
    "banarasi": "banarasi.jpg",
    "mysore": "mysore.jpg",
    "cotton": "cotton.jpg",
    "store": "store.jpg",
}


def img(key: str) -> str:
    return _ASSET_BASE + _IMAGES[key]


def cat_url(name: str, title: Optional[str] = None) -> str:
    """Product listing filtered by category; `collection` sets the maroon banner title."""
    cat = name.strip()
    display = (title or name).strip()
    params: Dict[str, str] = {"category": cat}
    if display:
        params["collection"] = display
    return "/products?" + urlencode(params)


def L(label: str, category: Optional[str] = None) -> Dict[str, str]:
    cat = category or label
    return {"label": label, "url": cat_url(cat, label)}


def tile(label: str, image: Optional[str] = None, category: Optional[str] = None) -> Dict[str, str]:
    t = {"label": label, "url": cat_url(category or label, label)}
    if image:
        t["image_url"] = img(image)
    return t


def _links(names: List[str]) -> List[Dict[str, str]]:
    return [L(n) for n in names]


# --------------------------------------------------------------------------- mega menu

MEGA_MENU: List[Dict[str, Any]] = [
    {"label": "New Arrivals", "url": "/new-arrivals"},
    {
        "label": "Kanchipurams", "url": cat_url("Kanchipuram"), "layout": "tiles",
        "panel_title": "Welcome to the Kanchipuram Store",
        "tiles": [
            tile("Bridal Kanchipuram Silks", "kanchipuram", "Bridal Kanchipuram"),
            tile("Festive Kanchipuram Silks", None, "Festive Kanchipuram"),
            tile("Soft Silk Kanchipurams", "mysore", "Soft Silk"),
            tile("Handpicked Kanchipurams", None, "Handpicked Kanchipuram"),
            tile("Budget Kanchipurams", None, "Budget Kanchipuram"),
            tile("Kanchipuram Exclusives", None, "Kanchipuram Exclusives"),
            tile("Pure Zari Bridal Kanchipurams", None, "Pure Zari"),
            tile("Kora Kanchipuram Silks", None, "Kora Kanchipuram"),
        ],
    },
    {
        "label": "Silk Sarees", "url": cat_url("Silk Sarees"), "layout": "columns",
        "feature_image": img("mysore"), "feature_url": cat_url("Silk Sarees"),
        "footer_link_label": "All Silk Sarees",
        "columns": [
            {"title": "Heritage Looms", "links": _links([
                "Mysore Crepe Silks", "Uppada Silk Sarees", "Gadwal Silks", "Pochampally Ikat Silk Sarees",
                "Venkatagiri Silk Sarees", "Paithani Silk Sarees", "Pure Chanderi Silks"])},
            {"title": "Collector's Special", "links": _links([
                "Pure Zari Kota Sarees", "Pure Silk Kota Sarees", "Designer Crepe & Georgettes", "Pure Tissue Silk Sarees"])},
            {"title": "Featured Pure Silks", "links": _links([
                "Printed Silk Sarees", "Chiffon Sarees", "Banana Silk Sarees", "Munga Tussar Sarees", "Bangalori Silks"])},
            {"title": "Contemporary Silk Sarees", "links": _links([
                "Pure Raw Silks", "Linen Silk Sarees", "Dupion Silk", "Pure Organza Sarees", "Matka Silks"])},
        ],
    },
    {
        "label": "Banarasi Silks", "url": cat_url("Banarasi"), "layout": "columns",
        "feature_image": img("banarasi"), "feature_url": cat_url("Banarasi"),
        "footer_link_label": "All Banarasi Silks",
        "columns": [
            {"title": "Banarasi Traditional", "links": _links([
                "Banarasi Silks", "Banarasi Crepes", "Banarasi Georgettes", "Banarasi Raw Silks",
                "Banarasi Kora Silks", "Banarasi Tissue Silk Sarees"])},
            {"title": "Banarasi Essentials", "links": _links([
                "Poona Silks", "Chiniya Silks", "Banarasi Tussars", "Banarasi Organzas", "Embroidered Banarasis"])},
        ],
    },
    {
        "label": "Wedding Curations", "url": cat_url("Wedding"), "layout": "columns",
        "feature_image": img("hero"), "feature_url": cat_url("Wedding"),
        "footer_link_label": "All Wedding Curations",
        "columns": [
            {"title": "Bridal & Wedding", "links": _links([
                "Bridal Trousseau", "Muhurtham Collection", "Reception Sarees", "Engagement Edit",
                "Mehendi & Haldi", "Mother of the Bride"])},
            {"title": "Curated Edits", "links": _links([
                "Luxury Silks", "Saree with Jewellery Combo", "Festive Silk Edit", "Best Sellers"])},
        ],
    },
    {
        "label": "Silk Cotton Sarees", "url": cat_url("Silk Cotton"), "layout": "columns",
        "feature_image": img("cotton"), "feature_url": cat_url("Silk Cotton"),
        "footer_link_label": "All Silk Cotton Sarees",
        "columns": [
            {"title": "Traditional Silk Cottons", "links": _links([
                "Gems of Silk Cottons", "Kuppadam Silk Cottons", "Korvai Silk Cottons", "Simple Silk Cottons",
                "Gollabama Silk Cottons", "Venkatagiri Silk Cottons"])},
            {"title": "Silk Cotton Essentials", "links": _links([
                "Ikat Silk Cottons", "Kora Silk Cottons", "Chanderi Silk Cottons", "Jamdani Silk Cottons",
                "Narayanpet Silk Cottons", "Chettinad Silk Cottons", "Mangalagiri Silk Cottons", "Coimbatore Silk Cottons"])},
            {"title": "Contemporary Silk Cottons", "links": _links([
                "Printed Silk Cottons", "Kota Silk Cottons", "Tissue Silk Cottons", "Embroidered Silk Cottons",
                "Designer Silk Cottons"])},
        ],
    },
    {
        "label": "Cotton Sarees", "url": cat_url("Cotton"), "layout": "columns",
        "feature_image": img("cotton"), "feature_url": cat_url("Cotton"),
        "columns": [
            {"title": "Timeless Prints", "links": _links([
                "Jaipur Cottons", "Kalamkari Cottons", "Mul Cottons", "Batik Cottons", "Kota Cottons"])},
            {"title": "Handloom Cotton Sarees", "links": _links([
                "Kanchi Cotton Sarees", "Pure Linen Sarees", "Mangalagiri Cottons", "Handloom Kota Sarees"])},
        ],
    },
    {
        "label": "Work Wear Sarees", "url": cat_url("Work Wear"), "layout": "columns",
        "feature_image": img("mysore"), "feature_url": cat_url("Work Wear"),
        "footer_link_label": "All Work Wear Sarees",
        "columns": [
            {"title": "Popular", "links": _links([
                "Semi Mysore Silk Sarees", "Kalamkari Semi Silk", "Semi Raw Silk Sarees", "Tissue Sarees"])},
            {"title": "Party Wear Sarees", "links": _links([
                "Embroidered Chiffon Sarees", "Semi Georgettes", "Embroidered Sarees", "Satin Silk Sarees"])},
        ],
    },
    {
        "label": "Bridal Jewellery", "url": cat_url("Jewellery"), "layout": "columns",
        "columns": [
            {"title": "Necklace", "links": _links([
                "Antique Necklace", "Jadau Necklace", "Pearl Necklace", "AD-Zircon Necklace"])},
            {"title": "Haaram & Choker", "links": _links([
                "Antique Haaram", "Jadau Haaram", "Antique Choker", "Pearl Choker"])},
            {"title": "Bangles & Earrings", "links": _links([
                "Antique Bangles", "Jadau Bangles", "Antique Jhumkas", "Bugadi Earrings"])},
            {"title": "Other Accessories", "links": _links([
                "Maang Tikka", "Hip Belts", "Mangalsutra", "Combo Sets"])},
        ],
    },
    {
        "label": "Ethnics", "url": cat_url("Ethnic"), "layout": "columns",
        "feature_image": img("store"), "feature_url": cat_url("Ethnic"),
        "footer_link_label": "All Ethnic Wear",
        "columns": [
            {"title": "Kids' Ethnic Wear", "links": _links([
                "Unstitched Lehengas", "Ready-to-wear Lehengas", "Pavadai Davani"])},
            {"title": "Blouses", "links": _links([
                "Readymade Blouse", "Blouse Bits", "Pure Tussar Blouse Pieces"])},
        ],
    },
]


# --------------------------------------------------------------------------- shared blocks

def announcement() -> Dict[str, Any]:
    return {"block_type": "announcement_bar", "props": {
        "lead_text": "Wedding Season", "text_highlight": "Flat 10% off",
        "text": "on all sarees · new arrivals every single day",
        "accent_color": "#E8B96A", "color": "#4A0833", "show_close": False,
    }}


def nav() -> Dict[str, Any]:
    return {"block_type": "nav", "props": {
        "brand": BRAND, "show_logo": True, "show_brand_name": True,
        "nav_bg": PRIMARY, "show_nav_links": False,
        "show_search": True, "show_cart": True, "show_login": True,
        "brand_name_size": "md",
        "header_bar_size": 64,
        "search_style": "bar", "search_placeholder": "What are you looking for?",
        "show_cart_total": True, "cart_total_prefix": "Rs.",
    }}


def mega_nav() -> Dict[str, Any]:
    return {"block_type": "silk_atelier_mega_nav", "label": "Collections menu", "props": {
        "items": MEGA_MENU, "bar_bg": "#FFFFFF", "bar_text": INK, "panel_bg": "#F6F3EE",
        "bar_height": 44,
        "mobile_label": "Browse collections",
    }}


def footer() -> Dict[str, Any]:
    return {"block_type": "footer", "props": {
        "brand": BRAND,
        "footer_bg": "#5A0B3A",
        "footer_style": "silk_atelier",
        "newsletter_blurb": "Subscribe and get notified on new arrivals, offers & much more!",
        "registered_address": (
            f"{BRAND}\n"
            "11, Main Road, T Nagar\n"
            "Chennai, Tamil Nadu — 600017\n"
            "GSTIN: (add your GSTIN in builder)"
        ),
        "copyright": f"© {datetime.utcnow().year} {BRAND}. All rights reserved.",
        "show_legal": False, "show_social": False, "show_newsletter": True, "show_powered_by": True,
        "social_links": {"whatsapp": "", "instagram": "", "facebook": "", "youtube": ""},
        "footer_columns": [
            {"title": "Policies", "links": [
                {"label": "Returns", "href": "/returns"},
                {"label": "Terms & Conditions", "href": "/terms-and-conditions"},
                {"label": "Domestic & International Shipping", "href": "/shipping"},
                {"label": "Privacy Policy", "href": "/privacy-policy"},
                {"label": "Do Not Sell My Information", "href": "/privacy-policy"},
            ]},
            {"title": "Support", "links": [
                {"label": "Initiate or Track Your Return", "href": "/returns"},
                {"label": "Contact Us", "href": "/contact"},
            ]},
            {"title": "Our Stores", "links": [
                {"label": "Chennai", "href": "/contact"},
                {"label": "Bengaluru", "href": "/contact"},
                {"label": "Hyderabad", "href": "/contact"},
                {"label": "Coimbatore", "href": "/contact"},
            ]},
        ],
    }}


def newsletter() -> Dict[str, Any]:
    return {"block_type": "newsletter", "props": {
        "title": "Be the first to know",
        "subtitle": "Subscribe and get notified on new arrivals, offers and wedding-season edits.",
        "cta_label": "Subscribe",
    }}


# --------------------------------------------------------------------------- pages

LIVE = {"show_count": 200}  # product feeds are filtered client-side; fetch a full catalog window


def drops_block() -> Dict[str, Any]:
    return {"block_type": "silk_atelier_drops", "label": "Today's New Arrivals", "props": {
        **LIVE,
        "title_before": "Today's", "title_accent": "New Arrivals",
        "subtitle": "Fresh designs unlock through the day. Swipe to browse.",
        "unlock_by_time": True, "items_per_slot": 10,
        "slots": [
            {"time": "7:00 AM", "label": "Patola Silk Sarees", "category_filter": ["Patola", "Rajkot"], "url": cat_url("Patola")},
            {"time": "10:45 AM", "label": "Vaibhogam — Festive Kanchipuram", "category_filter": ["Kanchipuram"], "url": cat_url("Kanchipuram")},
            {"time": "1:45 PM", "label": "Semi Mysore Silks", "category_filter": ["Mysore"], "url": cat_url("Mysore")},
            {"time": "5:00 PM", "label": "Pochampally Silk", "category_filter": ["Pochampally"], "url": cat_url("Pochampally")},
            {"time": "8:00 PM", "label": "LILA — Luxury Indian Silks", "category_filter": ["Silk"], "url": cat_url("Silk")},
        ],
        "extra_links": [
            {
                "label": "Antique Necklace",
                "category_filter": ["Antique Necklace", "Antique", "Necklace"],
                "url": cat_url("Antique Necklace"),
            },
            {
                "label": "Bridal Jewellery",
                "category_filter": ["Jewellery", "Bridal", "Jadau", "Necklace", "Haaram", "Choker", "Bangles"],
                "url": cat_url("Bridal Jewellery"),
            },
        ],
    }}


def stores_block() -> Dict[str, Any]:
    return {"block_type": "silk_atelier_stores", "label": "Visit our stores", "props": {
        "chip": "Our showroom", "title": "Visit Our Stores",
        "subtitle": "Experience our full collection in person: wedding silks, bridal trousseau and festive favourites.",
        "columns": 2,
        "stores": [
            {"city": "Main showroom", "name": BRAND, "address": "Add your showroom address here.",
             "image_url": img("store"), "phone": "", "map_url": "", "rating": 0, "reviews": 0},
        ],
    }}


def _loom(name: str, state: str, story: str, weave: str, known: str, wear: str, tag: str,
          hero: Optional[str] = None) -> Dict[str, Any]:
    d: Dict[str, Any] = {
        "name": name, "state": state, "certified": True, "story": story, "weave": weave,
        "known_for": known, "wear_for": wear, "category_filter": [tag], "view_all_url": cat_url(tag),
    }
    if hero:
        d["hero_image"] = img(hero)
        d["thumb_image"] = img(hero)
    return d


def home_blocks() -> List[Dict[str, Any]]:
    return [
        announcement(),
        nav(),
        mega_nav(),
        {"block_type": "silk_atelier_hero", "label": "Festive banner", "props": {
            "image_url": img("hero"), "image_alt": "Silk sarees draped beside brass diyas",
            "eyebrow": "Wedding Season", "headline": "Light Up", "headline_accent": "Every Celebration",
            "offer": "Flat 10% Off", "subtitle": "Pure silks, bridal sarees and festive favourites. New designs every day.",
            "cta_primary": "Shop the collection", "cta_primary_url": "/products",
            "cta_secondary": "Today's new arrivals", "cta_secondary_url": "/new-arrivals",
            "text_align": "right", "min_height": 480,
        }},
        drops_block(),
        {"block_type": "silk_atelier_brand_tabs", "label": "Signature collection", "props": {
            **LIVE,
            "eyebrow": "Tradition for generations",
            "title_before": "Pure", "title_accent": "Kanchipuram", "title_after": "Silks",
            "subtitle": "Handwoven in pure silk and zari: our largest curation for the bride and her family.",
            "chips": ["Handwoven in Kanchipuram", "Pure silk & zari", f"Curated by {BRAND}"],
            "items_per_tab": 12,
            "brands": [
                {"name": "Bridal Kanchipuram", "designs_label": "200+", "category_filter": ["Bridal Kanchipuram", "Bridal"],
                 "promo_image": img("kanchipuram"), "explore_url": cat_url("Bridal Kanchipuram")},
                {"name": "Festive Kanchipuram", "designs_label": "180+", "category_filter": ["Festive Kanchipuram", "Festive"],
                 "promo_image": img("kanchipuram"), "explore_url": cat_url("Festive Kanchipuram")},
                {"name": "Soft Silks", "designs_label": "300+", "category_filter": ["Soft Silk"],
                 "promo_image": img("mysore"), "explore_url": cat_url("Soft Silk")},
                {"name": "Handpicked", "designs_label": "150+", "category_filter": ["Handpicked", "Kanchipuram"],
                 "promo_image": img("kanchipuram"), "explore_url": cat_url("Kanchipuram")},
            ],
        }},
        {"block_type": "silk_atelier_looms", "label": "Heritage Looms", "props": {
            **LIVE,
            "eyebrow": "The silk saree store", "title": "Heritage Looms",
            "subtitle": "A celebration of India's silk legacy. Explore pure silk sarees across regions and weaving styles.",
            "badge_label": "Silk Mark Certified", "items_per_tab": 11,
            "looms": [
                _loom("Mysore Silk", "Karnataka",
                      "Woven from pure mulberry silk in a soft crepe, Mysore silks are loved for their fluid drape, gentle sheen and slim zari borders.",
                      "Pure crepe silk · pure zari", "Lightweight drape · slim zari", "Festive & office", "Mysore", hero="mysore"),
                _loom("Pochampally Ikat", "Telangana",
                      "Threads are resist-dyed before they reach the loom, so the geometric patterns appear as the saree is woven.",
                      "Tie-and-dye ikat weave", "Ikat · handwoven", "Day functions", "Pochampally"),
                _loom("Uppada Silk", "Andhra Pradesh",
                      "Featherlight silks from the coastal looms of Uppada, with motifs woven thread by thread in the jamdani style.",
                      "Jamdani-style weaving", "Jamdani · featherlight", "Weddings & receptions", "Uppada"),
                _loom("Venkatagiri Silk", "Andhra Pradesh",
                      "Known for a fine, smooth weave and delicate zari buttas set against a crisp body.",
                      "Fine-count weave · zari motifs", "Fine weave · zari buttas", "Festive", "Venkatagiri"),
                _loom("Gadwal Silk", "Telangana",
                      "The body and the contrasting silk border and pallu are woven separately and interlocked by hand, with temple-style borders.",
                      "Interlocked kupadam weave", "Kupadam · temple border", "Weddings & poojas", "Gadwal"),
                _loom("Patola Silk", "Gujarat",
                      "Vivid geometric patterns created by dyeing the yarn before weaving: a celebration of colour from Gujarat.",
                      "Ikat silk · bold geometry", "Vivid colours · handwoven", "Celebrations", "Patola"),
            ],
        }},
        {"block_type": "silk_atelier_tiles", "label": "Banaras weaves", "props": {
            "title": "Banaras Weaves",
            "subtitle": f"Pure silks from the looms of Banaras, curated by {BRAND}.",
            "shape": "arch", "columns": 4,
            "sections": [
                {"heading": "Banarasi Traditional", "items": [
                    {"title": "Silks", "subtitle": "170+ DESIGNS", "image_url": img("banarasi"), "url": cat_url("Banarasi Silks")},
                    {"title": "Crepes", "subtitle": "140+ DESIGNS", "url": cat_url("Banarasi Crepes")},
                    {"title": "Georgettes", "subtitle": "50+ DESIGNS", "url": cat_url("Banarasi Georgettes")},
                    {"title": "Raw Silks", "subtitle": "20+ DESIGNS", "url": cat_url("Banarasi Raw Silks")},
                    {"title": "Kora Silks", "subtitle": "20+ DESIGNS", "url": cat_url("Banarasi Kora Silks")},
                    {"title": "Tissue Silk", "subtitle": "140+ DESIGNS", "url": cat_url("Banarasi Tissue Silk Sarees")},
                ]},
                {"heading": "Banarasi Essentials", "items": [
                    {"title": "Poona Silks", "subtitle": "70+ DESIGNS", "url": cat_url("Poona Silks")},
                    {"title": "Chiniya Silks", "subtitle": "30+ DESIGNS", "url": cat_url("Chiniya Silks")},
                    {"title": "Tussars", "subtitle": "180+ DESIGNS", "url": cat_url("Banarasi Tussars")},
                    {"title": "Organzas", "subtitle": "20+ DESIGNS", "url": cat_url("Banarasi Organzas")},
                    {"title": "Embroidered Banarasis", "subtitle": "80+ DESIGNS", "url": cat_url("Embroidered Banarasis")},
                ]},
            ],
            "cta_label": "Explore all Banarasi", "cta_url": cat_url("Banarasi"),
        }},
        {"block_type": "silk_atelier_product_carousel", "label": "Luxury silks", "props": {
            **LIVE,
            "title_bold": "ROYAL", "title": "Luxury Indian Silks",
            "tagline": "Where tradition dares to dream bigger",
            "category_filter": ["Luxury", "Royal", "Bridal"], "count": 12,
            "card_shape": "portrait", "card_width": 250, "view_all_url": cat_url("Luxury Silks"),
        }},
        {"block_type": "silk_atelier_tiles", "label": "Wedding curations", "props": {
            "title": "Exclusive Curations", "title_bold": "Our", "shape": "poster", "layout": "scroll",
            "section_bg": "#FFFFFF",
            "sections": [{"items": [
                {"title": "Bridal Trousseau", "url": cat_url("Bridal Trousseau"), "image_url": img("hero")},
                {"title": "Muhurtham Collection", "url": cat_url("Muhurtham Collection"), "image_url": img("kanchipuram")},
                {"title": "Reception Edit", "url": cat_url("Reception Sarees"), "image_url": img("banarasi")},
                {"title": "Engagement Edit", "url": cat_url("Engagement Edit"), "image_url": img("mysore")},
                {"title": "Mehendi & Haldi", "url": cat_url("Mehendi & Haldi"), "image_url": img("cotton")},
            ]}],
        }},
        {"block_type": "silk_atelier_promo", "label": "Gift card", "props": {
            "eyebrow": "Wedding gifting",
            "title_before": "Gift the joy of", "title_accent": "a saree", "title_after": "this season.",
            "subtitle": "Not sure which saree they'll love? Gift a card. They choose the drape, you get the smile.",
            "amounts_label": "Choose a value", "amounts": ["₹1,000", "₹2,000", "₹5,000", "₹10,000"],
            "cta_label": "Gift a card", "cta_url": "/contact", "bg_image": img("hero"),
        }},
        {"block_type": "silk_atelier_tiles", "label": "Silk cottons", "props": {
            "title": "The Everyday Luxury Store", "title_bold": "Silk Cottons |",
            "subtitle": "For the woman who values tradition, but chooses comfort: a saree that moves with you, not against you.",
            "shape": "card", "columns": 3,
            "sections": [{"items": [
                {"title": "Silk Cotton Korvai", "url": cat_url("Korvai Silk Cottons"), "image_url": img("cotton")},
                {"title": "Silk Cotton 9 Yards", "url": cat_url("10 Yards in Silk Cottons")},
                {"title": "Kuppadam Sarees", "url": cat_url("Kuppadam Silk Cottons")},
                {"title": "Jacquard Silk Cottons", "url": cat_url("Silk Cotton")},
                {"title": "Gems of Silk Cottons", "url": cat_url("Gems of Silk Cottons")},
                {"title": "Simple Silk Cotton Sarees", "url": cat_url("Simple Silk Cottons")},
            ]}],
        }},
        {"block_type": "silk_atelier_product_carousel", "label": "Bride's wardrobe", "props": {
            **LIVE,
            "title_bold": "Bride's", "title": "Wardrobe", "category_filter": ["Bridal", "Wedding", "Trousseau"],
            "count": 10, "card_shape": "portrait", "card_width": 230, "view_all_url": cat_url("Bridal Trousseau"),
        }},
        {"block_type": "silk_atelier_tiles", "label": "Timeless favourites", "props": {
            "title": "Timeless Favorites", "shape": "round", "layout": "scroll", "section_bg": "#FFFFFF",
            "sections": [{"items": [
                {"title": "Kalamkari Cotton Sarees", "url": cat_url("Kalamkari Cottons"), "image_url": img("cotton")},
                {"title": "Semi Dola Sarees", "url": cat_url("Semi Dola Sarees")},
                {"title": "Kalamkari Semi Silk", "url": cat_url("Kalamkari Semi Silk")},
                {"title": "Semi Raw Silk Sarees", "url": cat_url("Semi Raw Silk Sarees")},
                {"title": "Jaipur Cotton Sarees", "url": cat_url("Jaipur Cottons")},
                {"title": "Banarasi Semi Crepe", "url": cat_url("Banarasi Semi Crepe Sarees"), "image_url": img("banarasi")},
                {"title": "Semi Mysore Silk Sarees", "url": cat_url("Semi Mysore Silk Sarees"), "image_url": img("mysore")},
            ]}],
        }},
        stores_block(),
        newsletter(),
        footer(),
    ]


def _policy_page(title: str, slug: str, html: str, sort_order: int) -> Dict[str, Any]:
    return {
        "title": title, "slug": slug, "page_type": "custom", "show_in_nav": False, "sort_order": sort_order,
        "blocks": [{"block_type": "rich_text", "props": {"content": html}}],
    }


def build_silk_atelier_template() -> Dict[str, Any]:
    pages: List[Dict[str, Any]] = [
        {"title": "Home", "slug": "home", "page_type": "home", "is_homepage": True, "show_in_nav": True,
         "sort_order": 0, "blocks": home_blocks()},
        {"title": "New Arrivals", "slug": "new-arrivals", "page_type": "custom", "show_in_nav": True, "sort_order": 1,
         "blocks": [drops_block(), newsletter()]},
        {"title": "About", "slug": "about", "page_type": "about", "show_in_nav": True, "sort_order": 2, "blocks": [
            {"block_type": "about_split", "props": {
                "title": f"About {BRAND}", "subtitle": "Our story", "layout": "split", "image_position": "right",
                "description": ("We curate pure silks, bridal sarees and festive collections for every celebration. "
                                "From Kanchipuram and Banarasi to Mysore, Pochampally and Uppada, every saree is handpicked "
                                "for quality, craftsmanship and value."),
                "image_url": img("store"),
            }},
            {"block_type": "stats", "props": {"title": "Why families choose us", "stats": [
                {"value": "1000+", "label": "Designs"}, {"value": "Pure", "label": "Silk & zari"},
                {"value": "10%", "label": "Off sitewide"}, {"value": "Daily", "label": "New arrivals"}]}},
            newsletter(),
        ]},
        {"title": "Contact", "slug": "contact", "page_type": "contact", "show_in_nav": True, "sort_order": 3, "blocks": [
            {"block_type": "contact_form", "props": {
                "title": "Contact us", "layout": "split", "email": "", "phone": "", "address": "", "show_map": False,
                "form_fields": [
                    {"name": "name", "type": "text", "required": True, "placeholder": "Your name"},
                    {"name": "phone", "type": "text", "required": False, "placeholder": "Phone number"},
                    {"name": "email", "type": "email", "required": True, "placeholder": "Your email"},
                    {"name": "message", "type": "textarea", "required": True, "placeholder": "How can we help?"},
                ],
            }},
            stores_block(),
        ]},
        _policy_page("Returns", "returns",
                     "<h2>Returns</h2><p>Add your returns policy here (eligibility window, condition of items, how to start a return).</p>", 4),
        _policy_page("Shipping", "shipping",
                     "<h2>Shipping</h2><p>Add your domestic and international shipping details here.</p>", 5),
        _policy_page("Privacy Policy", "privacy-policy",
                     "<h2>Privacy Policy</h2><p>Add your privacy policy here.</p>", 6),
        _policy_page("Terms & Conditions", "terms-and-conditions",
                     "<h2>Terms &amp; Conditions</h2><p>Add your terms and conditions here.</p>", 7),
    ]

    return {
        "id": TEMPLATE_ID,
        "name": "Silk Atelier",
        "description": ("Premium boutique storefront for sarees, silks, bridal wear and jewellery: "
                        "mega-menu, timed new-arrival drops, heritage collections, price-range category pages."),
        "thumbnail": img("hero"),
        "category": "fashion",
        "tier": "full",
        "tags": ["Fashion", "Sarees", "Jewellery", "Bridal", "Premium"],
        "preview_palette": [PRIMARY, SECONDARY, ACCENT, CREAM, INK],
        # "Your Brand" in any prop is replaced with the vendor's business name on apply.
        "brand_placeholder": BRAND,
        "default_style": {
            "primary_color": PRIMARY, "secondary_color": SECONDARY, "accent_color": ACCENT,
            "highlight_color": HIGHLIGHT,
            "bg_color": CREAM, "surface_color": "#FFFFFF", "text_color": INK,
            "font_heading": "Cormorant Garamond", "font_body": "Montserrat",
            "border_radius": "rounded", "spacing": "comfortable", "animation": "subtle",
            "shadow_style": "soft", "button_style": "pill", "container_width": "1400px",
            # Maroon collection banner + price-range chips on /products.
            "catalog_header": "silk_atelier",
        },
        "pages": pages,
    }
