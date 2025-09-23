"""
Feature Extraction Pipeline for Smart Bike Parts Recommendation System
Handles text processing, categorical encoding, numerical normalization, and compatibility matching
"""

import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
import re
import json
from typing import Dict, List, Tuple, Any, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BikePartsFeatureExtractor:
    """
    Comprehensive feature extraction for bike parts recommendations
    Handles text, categorical, numerical, and compatibility features
    """
    
    def __init__(self):
        """Initialize the feature extractor with default parameters"""
        self.tfidf_vectorizer = None
        self.categorical_encoder = None
        self.numerical_scaler = None
        self.compatibility_vocab = None
        self.feature_weights = {
            'text': 0.40,
            'categorical': 0.35, 
            'compatibility': 0.25
        }
        self.is_fitted = False
        
        # Bike-specific stop words and domain terms
        self.bike_stop_words = [
            'bike', 'motorcycle', 'vehicle', 'part', 'component', 'system',
            'ensures', 'performance', 'reliability', 'designed', 'quality'
        ]
        
        # Define complementary part categories
        self.complementary_categories = {
            'Engine & Top End': ['Filters', 'Fuel & Intake', 'Ignition', 'Cooling System'],
            'Brakes': ['Wheels', 'Suspension', 'Frame & Footrests'],
            'Fuel & Intake': ['Filters', 'Engine & Top End', 'Air Intake'],
            'Electrical': ['Ignition', 'Lighting', 'Instrumentation'],
            'Suspension': ['Brakes', 'Wheels', 'Frame & Footrests'],
            'Cooling System': ['Engine & Top End', 'Fuel & Intake'],
            'Drivetrain': ['Engine & Top End', 'Brakes'],
            'Lighting': ['Electrical', 'Indicator'],
            'Wheels': ['Brakes', 'Suspension'],
            'Cables': ['Brakes', 'Controls', 'Engine & Top End']
        }
    
    def preprocess_text(self, text: str) -> str:
        """
        Clean and preprocess text data for better feature extraction
        """
        if pd.isna(text) or text == '' or str(text).lower() == 'nan':
            return ''
        
        text = str(text).lower()
        
        # Remove special characters and extra spaces
        text = re.sub(r'[^\w\s]', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        
        # Remove bike-specific stop words
        words = text.split()
        words = [word for word in words if word not in self.bike_stop_words]
        
        return ' '.join(words).strip()
    
    def process_compatibility(self, compatibility_data: pd.Series) -> Tuple[np.ndarray, List[str]]:
        """
        Process compatibility data, handling empty/zero values properly
        Returns binary matrix and vocabulary of unique compatibility items
        """
        # Handle different types of compatibility data
        compatibility_sets = []
        all_compatibility_items = set()
        
        for item in compatibility_data:
            if pd.isna(item) or item == 0 or item == '0' or str(item).strip() == '':
                # Empty compatibility - create empty set
                compatibility_sets.append(set())
            elif isinstance(item, str):
                try:
                    # Try to parse as JSON array
                    if item.startswith('[') and item.endswith(']'):
                        parsed = json.loads(item)
                        if isinstance(parsed, list):
                            clean_items = [str(x).strip().lower() for x in parsed if str(x).strip()]
                            item_set = set(clean_items)
                            compatibility_sets.append(item_set)
                            all_compatibility_items.update(item_set)
                        else:
                            compatibility_sets.append(set())
                    else:
                        # Single string item
                        clean_item = item.strip().lower()
                        if clean_item:
                            item_set = {clean_item}
                            compatibility_sets.append(item_set)
                            all_compatibility_items.add(clean_item)
                        else:
                            compatibility_sets.append(set())
                except (json.JSONDecodeError, ValueError):
                    # If parsing fails, treat as single string
                    clean_item = str(item).strip().lower()
                    if clean_item and clean_item != '0':
                        item_set = {clean_item}
                        compatibility_sets.append(item_set)
                        all_compatibility_items.add(clean_item)
                    else:
                        compatibility_sets.append(set())
            elif isinstance(item, list):
                # Already a list
                clean_items = [str(x).strip().lower() for x in item if str(x).strip()]
                item_set = set(clean_items)
                compatibility_sets.append(item_set)
                all_compatibility_items.update(item_set)
            else:
                # Other types - convert to string and process
                clean_item = str(item).strip().lower()
                if clean_item and clean_item != '0':
                    item_set = {clean_item}
                    compatibility_sets.append(item_set)
                    all_compatibility_items.add(clean_item)
                else:
                    compatibility_sets.append(set())
        
        # Create vocabulary from unique items
        compatibility_vocab = sorted(list(all_compatibility_items))
        
        # Create binary matrix
        compatibility_matrix = np.zeros((len(compatibility_sets), len(compatibility_vocab)))
        
        for i, item_set in enumerate(compatibility_sets):
            for item in item_set:
                if item in compatibility_vocab:
                    j = compatibility_vocab.index(item)
                    compatibility_matrix[i, j] = 1
        
        logger.info(f"Processed compatibility: {len(compatibility_vocab)} unique items, "
                   f"{np.sum(compatibility_matrix)} total connections")
        
        return compatibility_matrix, compatibility_vocab
    
    def extract_categorical_features(self, df: pd.DataFrame) -> np.ndarray:
        """
        Extract and encode categorical features
        """
        categorical_columns = ['company', 'brand', 'type', 'price_category', 'year_category', 'rating_tier']
        
        # Fill missing values
        categorical_data = df[categorical_columns].copy()
        for col in categorical_columns:
            if col in categorical_data.columns:
                categorical_data[col] = categorical_data[col].fillna('unknown')
            else:
                categorical_data[col] = 'unknown'
        
        if self.categorical_encoder is None:
            # Fit encoder during training
            self.categorical_encoder = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
            encoded_features = self.categorical_encoder.fit_transform(categorical_data)
        else:
            # Transform using fitted encoder
            encoded_features = self.categorical_encoder.transform(categorical_data)
        
        logger.info(f"Categorical features shape: {encoded_features.shape}")
        return encoded_features
    
    def extract_numerical_features(self, df: pd.DataFrame) -> np.ndarray:
        """
        Extract and normalize numerical features
        """
        numerical_columns = ['price', 'vehicleYear', 'rating', 'numReviews', 'countInStock']
        
        # Create numerical data with proper handling of missing values
        numerical_data = df[numerical_columns].copy()
        
        # Fill missing values with appropriate defaults
        numerical_data['price'] = pd.to_numeric(numerical_data['price'], errors='coerce').fillna(0)
        numerical_data['vehicleYear'] = pd.to_numeric(numerical_data['vehicleYear'], errors='coerce').fillna(2020)
        numerical_data['rating'] = pd.to_numeric(numerical_data['rating'], errors='coerce').fillna(0)
        numerical_data['numReviews'] = pd.to_numeric(numerical_data['numReviews'], errors='coerce').fillna(0)
        numerical_data['countInStock'] = pd.to_numeric(numerical_data['countInStock'], errors='coerce').fillna(0)
        
        if self.numerical_scaler is None:
            # Fit scaler during training
            self.numerical_scaler = StandardScaler()
            normalized_features = self.numerical_scaler.fit_transform(numerical_data)
        else:
            # Transform using fitted scaler
            normalized_features = self.numerical_scaler.transform(numerical_data)
        
        logger.info(f"Numerical features shape: {normalized_features.shape}")
        return normalized_features
    
    def extract_text_features(self, df: pd.DataFrame) -> np.ndarray:
        """
        Extract TF-IDF features from text data
        """
        # Use text_combined if available, otherwise create it
        if 'text_combined' in df.columns:
            text_data = df['text_combined'].fillna('')
        else:
            # Create combined text from available fields
            text_parts = []
            for col in ['name', 'model', 'company', 'brand', 'type', 'description']:
                if col in df.columns:
                    text_parts.append(df[col].fillna(''))
            text_data = text_parts[0] if text_parts else pd.Series([''] * len(df))
            for part in text_parts[1:]:
                text_data = text_data + ' ' + part
        
        # Preprocess text
        processed_text = text_data.apply(self.preprocess_text)
        
        if self.tfidf_vectorizer is None:
            # Fit vectorizer during training
            self.tfidf_vectorizer = TfidfVectorizer(
                max_features=5000,
                ngram_range=(1, 2),
                stop_words='english',
                min_df=2,
                max_df=0.95,
                sublinear_tf=True
            )
            tfidf_features = self.tfidf_vectorizer.fit_transform(processed_text)
        else:
            # Transform using fitted vectorizer
            tfidf_features = self.tfidf_vectorizer.transform(processed_text)
        
        logger.info(f"TF-IDF features shape: {tfidf_features.shape}")
        return tfidf_features.toarray()
    
    def fit_transform(self, df: pd.DataFrame) -> Dict[str, np.ndarray]:
        """
        Fit the feature extractors and transform the data
        """
        logger.info("Fitting feature extractors and transforming data...")
        
        # Extract all feature types
        text_features = self.extract_text_features(df)
        categorical_features = self.extract_categorical_features(df)
        numerical_features = self.extract_numerical_features(df)
        compatibility_features, self.compatibility_vocab = self.process_compatibility(df['compatibility'])
        
        self.is_fitted = True
        
        features = {
            'text': text_features,
            'categorical': categorical_features,
            'numerical': numerical_features,
            'compatibility': compatibility_features
        }
        
        logger.info(f"Feature extraction complete. Shapes: "
                   f"text={text_features.shape}, "
                   f"categorical={categorical_features.shape}, "
                   f"numerical={numerical_features.shape}, "
                   f"compatibility={compatibility_features.shape}")
        
        return features
    
    def transform(self, df: pd.DataFrame) -> Dict[str, np.ndarray]:
        """
        Transform new data using fitted extractors
        """
        if not self.is_fitted:
            raise ValueError("Feature extractors must be fitted first. Call fit_transform().")
        
        logger.info("Transforming new data...")
        
        # Extract all feature types using fitted extractors
        text_features = self.extract_text_features(df)
        categorical_features = self.extract_categorical_features(df)
        numerical_features = self.extract_numerical_features(df)
        
        # Process compatibility with existing vocabulary
        compatibility_features = np.zeros((len(df), len(self.compatibility_vocab)))
        for i, compatibility_item in enumerate(df['compatibility']):
            if pd.notna(compatibility_item) and compatibility_item != 0 and str(compatibility_item) != '0':
                try:
                    if isinstance(compatibility_item, str) and compatibility_item.startswith('['):
                        parsed_items = json.loads(compatibility_item)
                        if isinstance(parsed_items, list):
                            for item in parsed_items:
                                clean_item = str(item).strip().lower()
                                if clean_item in self.compatibility_vocab:
                                    j = self.compatibility_vocab.index(clean_item)
                                    compatibility_features[i, j] = 1
                except:
                    # Handle single string or parsing errors
                    clean_item = str(compatibility_item).strip().lower()
                    if clean_item in self.compatibility_vocab:
                        j = self.compatibility_vocab.index(clean_item)
                        compatibility_features[i, j] = 1
        
        features = {
            'text': text_features,
            'categorical': categorical_features,
            'numerical': numerical_features,
            'compatibility': compatibility_features
        }
        
        logger.info(f"Transform complete. Shapes: "
                   f"text={text_features.shape}, "
                   f"categorical={categorical_features.shape}, "
                   f"numerical={numerical_features.shape}, "
                   f"compatibility={compatibility_features.shape}")
        
        return features
    
    def get_feature_names(self) -> Dict[str, List[str]]:
        """
        Get feature names for each feature type
        """
        if not self.is_fitted:
            raise ValueError("Feature extractors must be fitted first.")
        
        feature_names = {
            'text': self.tfidf_vectorizer.get_feature_names_out().tolist() if self.tfidf_vectorizer else [],
            'categorical': self.categorical_encoder.get_feature_names_out().tolist() if self.categorical_encoder else [],
            'numerical': ['price', 'vehicleYear', 'rating', 'numReviews', 'countInStock'],
            'compatibility': self.compatibility_vocab if self.compatibility_vocab else []
        }
        
        return feature_names
    
    def save_extractors(self, base_path: str):
        """
        Save fitted extractors to disk
        """
        import pickle
        import os
        
        if not self.is_fitted:
            raise ValueError("Feature extractors must be fitted first.")
        
        os.makedirs(base_path, exist_ok=True)
        
        # Save each component
        with open(f"{base_path}/tfidf_vectorizer.pkl", 'wb') as f:
            pickle.dump(self.tfidf_vectorizer, f)
        
        with open(f"{base_path}/categorical_encoder.pkl", 'wb') as f:
            pickle.dump(self.categorical_encoder, f)
        
        with open(f"{base_path}/numerical_scaler.pkl", 'wb') as f:
            pickle.dump(self.numerical_scaler, f)
        
        with open(f"{base_path}/compatibility_vocab.pkl", 'wb') as f:
            pickle.dump(self.compatibility_vocab, f)
        
        with open(f"{base_path}/feature_weights.json", 'w') as f:
            json.dump(self.feature_weights, f)
        
        logger.info(f"Feature extractors saved to {base_path}")
    
    def load_extractors(self, base_path: str):
        """
        Load fitted extractors from disk
        """
        import pickle
        
        # Load each component
        with open(f"{base_path}/tfidf_vectorizer.pkl", 'rb') as f:
            self.tfidf_vectorizer = pickle.load(f)
        
        with open(f"{base_path}/categorical_encoder.pkl", 'rb') as f:
            self.categorical_encoder = pickle.load(f)
        
        with open(f"{base_path}/numerical_scaler.pkl", 'rb') as f:
            self.numerical_scaler = pickle.load(f)
        
        with open(f"{base_path}/compatibility_vocab.pkl", 'rb') as f:
            self.compatibility_vocab = pickle.load(f)
        
        with open(f"{base_path}/feature_weights.json", 'r') as f:
            self.feature_weights = json.load(f)
        
        self.is_fitted = True
        logger.info(f"Feature extractors loaded from {base_path}")

# Utility functions for feature engineering

def create_price_categories(prices: pd.Series) -> pd.Series:
    """
    Categorize prices into budget, mid-range, premium
    """
    price_75 = prices.quantile(0.75)
    price_25 = prices.quantile(0.25)
    
    def categorize_price(price):
        if pd.isna(price) or price == 0:
            return 'unknown'
        elif price <= price_25:
            return 'budget'
        elif price <= price_75:
            return 'mid-range'
        else:
            return 'premium'
    
    return prices.apply(categorize_price)

def create_year_categories(years: pd.Series) -> pd.Series:
    """
    Categorize vehicle years into vintage, classic, modern
    """
    current_year = 2025
    
    def categorize_year(year):
        if pd.isna(year) or year == 0:
            return 'unknown'
        elif year < current_year - 10:
            return 'vintage'
        elif year < current_year - 5:
            return 'classic'
        else:
            return 'modern'
    
    return years.apply(categorize_year)

def create_rating_tiers(ratings: pd.Series) -> pd.Series:
    """
    Categorize ratings into poor, good, excellent
    """
    def categorize_rating(rating):
        if pd.isna(rating) or rating == 0:
            return 'unrated'
        elif rating < 3.0:
            return 'poor'
        elif rating < 4.5:
            return 'good'
        else:
            return 'excellent'
    
    return ratings.apply(categorize_rating)

if __name__ == "__main__":
    # Test the feature extractor
    logger.info("Testing BikePartsFeatureExtractor...")
    
    # This would be used for testing with actual data
    # df = pd.read_csv("path/to/bike_parts_dataset.csv")
    # extractor = BikePartsFeatureExtractor()
    # features = extractor.fit_transform(df)
    # print("Feature extraction test completed successfully!")