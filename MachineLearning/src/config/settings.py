"""
Configuration settings for the recommendation system
"""
import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).parent.parent.parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"

# Data files
CSV_FILE_PATH = DATA_DIR / "bike_parts_dataset.csv"
SIMILARITY_MATRIX_PATH = MODELS_DIR / "similarity_matrix.pkl"
FEATURE_VECTORIZER_PATH = MODELS_DIR / "feature_vectorizer.pkl"

# MongoDB connection (will be passed from Node.js, but keeping for direct access)
MONGODB_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/bike_parts")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "bike_parts")

# API Settings
API_HOST = os.getenv("API_HOST", "127.0.0.1")
API_PORT = int(os.getenv("API_PORT", 8010))

# ML Model settings
DEFAULT_RECOMMENDATIONS_COUNT = 5
MAX_RECOMMENDATIONS_COUNT = 20
SIMILARITY_THRESHOLD = 0.1

# Feature weights for similarity calculation
FEATURE_WEIGHTS = {
    "text_similarity": 0.4,      # TF-IDF based text similarity
    "categorical_match": 0.3,    # Company, brand, type matching
    "numerical_similarity": 0.2,  # Price, year, rating similarity
    "compatibility_bonus": 0.1   # Compatibility overlap bonus
}

# Price categories (in INR)
PRICE_CATEGORIES = {
    "budget": (0, 1000),
    "mid-range": (1000, 5000),
    "premium": (5000, float('inf'))
}

# Year categories
YEAR_CATEGORIES = {
    "vintage": (1990, 2005),
    "classic": (2005, 2015),
    "modern": (2015, 2030)
}

# Rating tiers
RATING_TIERS = {
    "poor": (0, 2.5),
    "good": (2.5, 4.0),
    "excellent": (4.0, 5.0)
}

# CSV column mapping
CSV_COLUMNS = [
    'product_id', 'name', 'model', 'company', 'vehicleYear', 'brand', 'type',
    'price', 'description', 'countInStock', 'rating', 'numReviews',
    'compatibility', 'images', 'vendor_id', 'shop_id', 'shop_name',
    'shop_address', 'shop_lat', 'shop_lon', 'price_category', 'year_category',
    'rating_tier', 'text_combined', 'compatibility_count', 'created_at', 'updated_at'
]

# Text preprocessing settings
TEXT_PREPROCESSING = {
    "lowercase": True,
    "remove_punctuation": True,
    "remove_extra_spaces": True,
    "min_word_length": 2
}

# TF-IDF settings
TFIDF_SETTINGS = {
    "max_features": 5000,
    "ngram_range": (1, 2),
    "stop_words": "english",
    "min_df": 2,
    "max_df": 0.95
}