"""
Utility functions for data processing and feature engineering
"""
import re
import pandas as pd
from typing import List, Optional, Dict, Any
from datetime import datetime
from ..config.settings import PRICE_CATEGORIES, YEAR_CATEGORIES, RATING_TIERS, TEXT_PREPROCESSING

def clean_text(text: Optional[str]) -> str:
    """Clean and normalize text for processing"""
    if not text:
        return ""
    
    text = str(text)
    
    if TEXT_PREPROCESSING["lowercase"]:
        text = text.lower()
    
    if TEXT_PREPROCESSING["remove_punctuation"]:
        text = re.sub(r'[^\w\s]', ' ', text)
    
    if TEXT_PREPROCESSING["remove_extra_spaces"]:
        text = re.sub(r'\s+', ' ', text).strip()
    
    # Remove short words if configured
    if TEXT_PREPROCESSING["min_word_length"] > 1:
        words = text.split()
        words = [w for w in words if len(w) >= TEXT_PREPROCESSING["min_word_length"]]
        text = ' '.join(words)
    
    return text

def categorize_price(price: float) -> str:
    """Categorize price into budget/mid-range/premium"""
    for category, (min_price, max_price) in PRICE_CATEGORIES.items():
        if min_price <= price < max_price:
            return category
    return "premium"  # Default for very high prices

def categorize_year(year: Optional[int]) -> str:
    """Categorize vehicle year into vintage/classic/modern"""
    if not year:
        return "unknown"
    
    for category, (min_year, max_year) in YEAR_CATEGORIES.items():
        if min_year <= year < max_year:
            return category
    return "modern"  # Default for future years

def categorize_rating(rating: float) -> str:
    """Categorize rating into poor/good/excellent"""
    for tier, (min_rating, max_rating) in RATING_TIERS.items():
        if min_rating <= rating < max_rating:
            return tier
    return "excellent"  # Default for ratings >= 4.0

def combine_text_features(product_data: Dict[str, Any]) -> str:
    """Combine multiple text fields into a single feature string"""
    text_fields = [
        product_data.get('name', ''),
        product_data.get('model', ''),
        product_data.get('company', ''),
        product_data.get('brand', ''),
        product_data.get('type', ''),
        product_data.get('description', '')
    ]
    
    # Clean and combine
    cleaned_texts = [clean_text(field) for field in text_fields]
    combined = ' '.join(filter(None, cleaned_texts))
    
    return clean_text(combined)

def process_compatibility(compatibility: List[str]) -> tuple[str, int]:
    """Process compatibility list into string and count"""
    if not compatibility:
        return "", 0
    
    # Clean and join compatibility models
    cleaned_compatibility = [clean_text(model) for model in compatibility if model]
    compatibility_text = " | ".join(cleaned_compatibility)
    compatibility_count = len(cleaned_compatibility)
    
    return compatibility_text, compatibility_count

def process_images(images: List[str]) -> str:
    """Process images list into pipe-separated string"""
    if not images:
        return ""
    return " | ".join(images)

def normalize_price(price: float, min_price: float = 0, max_price: float = 50000) -> float:
    """Normalize price to 0-1 scale"""
    if max_price <= min_price:
        return 0.0
    return min(1.0, max(0.0, (price - min_price) / (max_price - min_price)))

def normalize_rating(rating: float) -> float:
    """Normalize rating to 0-1 scale"""
    return min(1.0, max(0.0, rating / 5.0))

def normalize_year(year: Optional[int], base_year: int = 1990) -> float:
    """Normalize year to 0-1 scale relative to base year"""
    if not year:
        return 0.0
    current_year = datetime.now().year
    if current_year <= base_year:
        return 0.0
    return min(1.0, max(0.0, (year - base_year) / (current_year - base_year)))

def extract_numerical_features(product_data: Dict[str, Any]) -> Dict[str, float]:
    """Extract and normalize numerical features"""
    return {
        'price_normalized': normalize_price(product_data.get('price', 0)),
        'rating_normalized': normalize_rating(product_data.get('rating', 0)),
        'year_normalized': normalize_year(product_data.get('vehicleYear')),
        'review_count_log': min(1.0, (product_data.get('numReviews', 0) + 1) / 100.0),
        'stock_availability': min(1.0, product_data.get('countInStock', 0) / 100.0)
    }

def calculate_text_similarity_score(text1: str, text2: str) -> float:
    """Calculate simple text similarity based on word overlap"""
    if not text1 or not text2:
        return 0.0
    
    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())
    
    if not words1 or not words2:
        return 0.0
    
    intersection = words1.intersection(words2)
    union = words1.union(words2)
    
    return len(intersection) / len(union) if union else 0.0

def validate_product_data(product_data: Dict[str, Any]) -> tuple[bool, List[str]]:
    """Validate product data for completeness and correctness"""
    errors = []
    
    # Required fields
    required_fields = ['product_id', 'price', 'vendor_id', 'shop_id']
    for field in required_fields:
        if not product_data.get(field):
            errors.append(f"Missing required field: {field}")
    
    # Price validation
    price = product_data.get('price', 0)
    if not isinstance(price, (int, float)) or price <= 0:
        errors.append("Price must be a positive number")
    
    # Year validation
    year = product_data.get('vehicleYear')
    if year and (not isinstance(year, int) or year < 1990 or year > datetime.now().year + 2):
        errors.append("Invalid vehicle year")
    
    # Rating validation
    rating = product_data.get('rating', 0)
    if not isinstance(rating, (int, float)) or rating < 0 or rating > 5:
        errors.append("Rating must be between 0 and 5")
    
    # Coordinates validation
    lat = product_data.get('shop_lat')
    lon = product_data.get('shop_lon')
    if lat is not None and (not isinstance(lat, (int, float)) or lat < -90 or lat > 90):
        errors.append("Invalid latitude")
    if lon is not None and (not isinstance(lon, (int, float)) or lon < -180 or lon > 180):
        errors.append("Invalid longitude")
    
    return len(errors) == 0, errors

def prepare_csv_row(product_data: Dict[str, Any]) -> Dict[str, Any]:
    """Prepare a product data row for CSV export"""
    # Process compatibility
    compatibility_text, compatibility_count = process_compatibility(
        product_data.get('compatibility', [])
    )
    
    # Process images
    images_text = process_images(product_data.get('images', []))
    
    # Generate derived features
    price_category = categorize_price(product_data.get('price', 0))
    year_category = categorize_year(product_data.get('vehicleYear'))
    rating_tier = categorize_rating(product_data.get('rating', 0))
    text_combined = combine_text_features(product_data)
    
    # Prepare timestamps
    now = datetime.now().isoformat()
    created_at = product_data.get('created_at', now)
    updated_at = product_data.get('updated_at', now)
    
    if isinstance(created_at, datetime):
        created_at = created_at.isoformat()
    if isinstance(updated_at, datetime):
        updated_at = updated_at.isoformat()
    
    return {
        'product_id': product_data.get('product_id', ''),
        'name': product_data.get('name', ''),
        'model': product_data.get('model', ''),
        'company': product_data.get('company', ''),
        'vehicleYear': product_data.get('vehicleYear', ''),
        'brand': product_data.get('brand', ''),
        'type': product_data.get('type', ''),
        'price': product_data.get('price', 0),
        'description': clean_text(product_data.get('description', '')),
        'countInStock': product_data.get('countInStock', 0),
        'rating': product_data.get('rating', 0),
        'numReviews': product_data.get('numReviews', 0),
        'compatibility': compatibility_text,
        'images': images_text,
        'vendor_id': product_data.get('vendor_id', ''),
        'shop_id': product_data.get('shop_id', ''),
        'shop_name': product_data.get('shop_name', ''),
        'shop_address': product_data.get('shop_address', ''),
        'shop_lat': product_data.get('shop_lat', ''),
        'shop_lon': product_data.get('shop_lon', ''),
        'price_category': price_category,
        'year_category': year_category,
        'rating_tier': rating_tier,
        'text_combined': text_combined,
        'compatibility_count': compatibility_count,
        'created_at': created_at,
        'updated_at': updated_at
    }