# app/utils/slug.py
from slugify import slugify
import uuid


def generate_slug(text: str) -> str:
    """Generate a URL-safe slug from text."""
    return slugify(text, lowercase=True, max_length=100)


def generate_unique_slug(text: str, existing_check=None) -> str:
    """
    Generate a unique slug, appending a suffix if needed.
    
    Args:
        text: The text to convert to a slug
        existing_check: Optional async function to check if slug exists
    
    Returns:
        A unique slug string
    """
    base_slug = generate_slug(text)
    
    if existing_check is None:
        return base_slug
    
    # If we have a check function, we'd use it in an async context
    # For now, return base with UUID suffix as fallback
    return f"{base_slug}-{str(uuid.uuid4())[:8]}"
