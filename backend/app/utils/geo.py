# app/utils/geo.py
import math
from typing import Optional


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance in kilometres between two lat/lng points using
    the Haversine formula.  Accurate enough for distances up to several
    hundred kilometres.
    """
    R = 6371.0  # Earth radius in km
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def is_within_radius(
    vendor_lat: float,
    vendor_lon: float,
    user_lat: float,
    user_lon: float,
    radius_km: float,
) -> bool:
    """Return True if user location is within vendor's service radius."""
    return haversine_km(vendor_lat, vendor_lon, user_lat, user_lon) <= radius_km


def bounding_box(lat: float, lon: float, radius_km: float) -> dict:
    """
    Return a bounding box (min/max lat/lng) for a rough SQL pre-filter.
    This avoids running Haversine on every row.
    """
    R = 6371.0
    delta_lat = math.degrees(radius_km / R)
    delta_lon = math.degrees(radius_km / (R * math.cos(math.radians(lat))))
    return {
        "min_lat": lat - delta_lat,
        "max_lat": lat + delta_lat,
        "min_lon": lon - delta_lon,
        "max_lon": lon + delta_lon,
    }
