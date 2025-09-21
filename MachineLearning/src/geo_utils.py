import math
from typing import Tuple

EARTH_R = 6371.0  # km

def haversine(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    """Return distance in km between two (lat, lon)."""
    lat1, lon1 = a
    lat2, lon2 = b
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    lat1_r = math.radians(lat1)
    lat2_r = math.radians(lat2)
    h = math.sin(dlat/2)**2 + math.cos(lat1_r)*math.cos(lat2_r)*math.sin(dlon/2)**2
    return 2 * EARTH_R * math.asin(math.sqrt(h))
