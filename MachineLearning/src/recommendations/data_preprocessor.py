"""
Data Preprocessing Module for Smart Bike Parts Recommendation System
Handles data cleaning, validation, and preparation for feature extraction
"""

import pandas as pd
import numpy as np
import json
import re
from typing import Dict, List, Tuple, Any, Optional
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BikePartsDataPreprocessor:
    """
    Comprehensive data preprocessing for bike parts dataset
    Handles missing values, data type conversions, and data validation
    """
    
    def __init__(self):
        """Initialize the data preprocessor"""
        self.required_columns = [
            'product_id', 'name', 'model', 'company', 'type', 'price'
        ]
        self.optional_columns = [
            'vehicleYear', 'brand', 'description', 'countInStock', 
            'rating', 'numReviews', 'compatibility', 'images',
            'vendor_id', 'shop_id', 'shop_name', 'shop_address',
            'shop_lat', 'shop_lon', 'created_at', 'updated_at'
        ]
        
        # Data validation rules
        self.validation_rules = {
            'price': {'min': 0, 'max': 100000},
            'vehicleYear': {'min': 1990, 'max': 2030},
            'rating': {'min': 0, 'max': 5},
            'numReviews': {'min': 0, 'max': 10000},
            'countInStock': {'min': 0, 'max': 10000}
        }
        
        # Common bike companies for validation
        self.known_companies = [
            'hero', 'bajaj', 'honda', 'yamaha', 'suzuki', 'ktm', 
            'royal enfield', 'tvs', 'kawasaki', 'harley davidson'
        ]
        
        # Common part types
        self.known_part_types = [
            'engine & top end', 'brakes', 'fuel & intake', 'electrical',
            'suspension', 'cooling system', 'drivetrain', 'lighting',
            'wheels', 'cables', 'filters', 'frame & footrests',
            'air intake', 'ignition', 'instrumentation', 'controls',
            'bottom end & crankcase', 'indicator', 'body part', 'plastic'
        ]
    
    def load_dataset(self, file_path: str) -> pd.DataFrame:
        """
        Load the bike parts dataset from CSV file
        """
        try:
            logger.info(f"Loading dataset from {file_path}")
            df = pd.read_csv(file_path)
            logger.info(f"Dataset loaded successfully. Shape: {df.shape}")
            return df
        except Exception as e:
            logger.error(f"Error loading dataset: {e}")
            raise
    
    def validate_required_columns(self, df: pd.DataFrame) -> bool:
        """
        Validate that all required columns are present
        """
        missing_columns = []
        for col in self.required_columns:
            if col not in df.columns:
                missing_columns.append(col)
        
        if missing_columns:
            logger.error(f"Missing required columns: {missing_columns}")
            return False
        
        logger.info("All required columns are present")
        return True
    
    def clean_text_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Clean and standardize text data
        """
        logger.info("Cleaning text data...")
        
        text_columns = ['name', 'model', 'company', 'brand', 'type', 'description', 'shop_name']
        
        for col in text_columns:
            if col in df.columns:
                # Handle missing values
                df[col] = df[col].fillna('')
                
                # Convert to string and strip whitespace
                df[col] = df[col].astype(str).str.strip()
                
                # Remove extra spaces
                df[col] = df[col].str.replace(r'\s+', ' ', regex=True)
                
                # Handle special cases for specific columns
                if col in ['company', 'brand']:
                    # Standardize company/brand names
                    df[col] = df[col].str.lower().str.title()
                elif col == 'type':
                    # Standardize part types
                    df[col] = df[col].str.lower().str.title()
        
        logger.info("Text data cleaning completed")
        return df
    
    def clean_numerical_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Clean and validate numerical data
        """
        logger.info("Cleaning numerical data...")
        
        numerical_columns = ['price', 'vehicleYear', 'rating', 'numReviews', 'countInStock', 'shop_lat', 'shop_lon']
        
        for col in numerical_columns:
            if col in df.columns:
                # Convert to numeric, coercing errors to NaN
                df[col] = pd.to_numeric(df[col], errors='coerce')
                
                # Apply validation rules if they exist
                if col in self.validation_rules:
                    rules = self.validation_rules[col]
                    
                    # Replace values outside valid range with NaN
                    df.loc[(df[col] < rules['min']) | (df[col] > rules['max']), col] = np.nan
                    
                    # Log any invalid values found
                    invalid_count = df[col].isna().sum()
                    if invalid_count > 0:
                        logger.warning(f"Found {invalid_count} invalid values in {col}")
                
                # Fill missing values with appropriate defaults
                if col == 'price':
                    df[col] = df[col].fillna(0)
                elif col == 'vehicleYear':
                    df[col] = df[col].fillna(2020)  # Default to 2020
                elif col in ['rating', 'numReviews', 'countInStock']:
                    df[col] = df[col].fillna(0)
                elif col in ['shop_lat', 'shop_lon']:
                    # Don't fill coordinates - leave as NaN if invalid
                    pass
        
        logger.info("Numerical data cleaning completed")
        return df
    
    def clean_compatibility_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Clean and standardize compatibility data
        """
        logger.info("Cleaning compatibility data...")
        
        if 'compatibility' not in df.columns:
            df['compatibility'] = 0  # Default empty compatibility
            return df
        
        def clean_compatibility_value(value):
            """Clean individual compatibility value"""
            if pd.isna(value) or value == 0 or str(value).strip() in ['', '0', 'nan', 'null']:
                return 0  # Standard empty value
            
            try:
                # If it's already a string that looks like JSON
                if isinstance(value, str):
                    value = value.strip()
                    if value.startswith('[') and value.endswith(']'):
                        # Try to parse as JSON
                        parsed = json.loads(value)
                        if isinstance(parsed, list) and len(parsed) > 0:
                            # Clean each item in the list
                            cleaned_list = [str(item).strip() for item in parsed if str(item).strip()]
                            return json.dumps(cleaned_list) if cleaned_list else 0
                        else:
                            return 0
                    else:
                        # Single string value
                        clean_value = value.strip()
                        return json.dumps([clean_value]) if clean_value else 0
                elif isinstance(value, list):
                    # Already a list
                    cleaned_list = [str(item).strip() for item in value if str(item).strip()]
                    return json.dumps(cleaned_list) if cleaned_list else 0
                else:
                    # Convert to string and process
                    str_value = str(value).strip()
                    return json.dumps([str_value]) if str_value and str_value != '0' else 0
            except:
                # If any parsing fails, check if it's a valid single string
                str_value = str(value).strip()
                if str_value and str_value not in ['0', 'nan', 'null']:
                    return json.dumps([str_value])
                else:
                    return 0
        
        df['compatibility'] = df['compatibility'].apply(clean_compatibility_value)
        
        # Count how many products have compatibility data
        has_compatibility = (df['compatibility'] != 0).sum()
        total_products = len(df)
        logger.info(f"Compatibility data: {has_compatibility}/{total_products} products have compatibility info")
        
        return df
    
    def create_derived_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Create derived features for better ML performance
        """
        logger.info("Creating derived features...")
        
        # Price categories
        if 'price' in df.columns:
            prices = pd.to_numeric(df['price'], errors='coerce').fillna(0)
            df['price_category'] = self.create_price_categories(prices)
        
        # Year categories
        if 'vehicleYear' in df.columns:
            years = pd.to_numeric(df['vehicleYear'], errors='coerce').fillna(2020)
            df['year_category'] = self.create_year_categories(years)
        
        # Rating tiers
        if 'rating' in df.columns:
            ratings = pd.to_numeric(df['rating'], errors='coerce').fillna(0)
            df['rating_tier'] = self.create_rating_tiers(ratings)
        
        # Combined text for TF-IDF
        text_columns = ['name', 'model', 'company', 'brand', 'type', 'description']
        available_text_columns = [col for col in text_columns if col in df.columns]
        
        if available_text_columns:
            df['text_combined'] = df[available_text_columns].fillna('').apply(
                lambda row: ' '.join(row.values.astype(str)), axis=1
            )
        else:
            df['text_combined'] = ''
        
        # Compatibility count
        def count_compatibility_items(compatibility):
            if compatibility == 0 or pd.isna(compatibility):
                return 0
            try:
                if isinstance(compatibility, str) and compatibility.startswith('['):
                    parsed = json.loads(compatibility)
                    return len(parsed) if isinstance(parsed, list) else 0
                else:
                    return 1 if str(compatibility).strip() else 0
            except:
                return 1 if str(compatibility).strip() and str(compatibility) != '0' else 0
        
        if 'compatibility' in df.columns:
            df['compatibility_count'] = df['compatibility'].apply(count_compatibility_items)
        else:
            df['compatibility_count'] = 0
        
        logger.info("Derived features created successfully")
        return df
    
    def create_price_categories(self, prices: pd.Series) -> pd.Series:
        """Categorize prices into budget, mid-range, premium"""
        valid_prices = prices[prices > 0]
        if len(valid_prices) == 0:
            return pd.Series(['unknown'] * len(prices))
        
        price_25 = valid_prices.quantile(0.25)
        price_75 = valid_prices.quantile(0.75)
        
        def categorize_price(price):
            if pd.isna(price) or price <= 0:
                return 'unknown'
            elif price <= price_25:
                return 'budget'
            elif price <= price_75:
                return 'mid-range'
            else:
                return 'premium'
        
        return prices.apply(categorize_price)
    
    def create_year_categories(self, years: pd.Series) -> pd.Series:
        """Categorize vehicle years"""
        current_year = datetime.now().year
        
        def categorize_year(year):
            if pd.isna(year) or year <= 0:
                return 'unknown'
            elif year < current_year - 10:
                return 'vintage'
            elif year < current_year - 5:
                return 'classic'
            else:
                return 'modern'
        
        return years.apply(categorize_year)
    
    def create_rating_tiers(self, ratings: pd.Series) -> pd.Series:
        """Categorize ratings into tiers"""
        def categorize_rating(rating):
            if pd.isna(rating) or rating <= 0:
                return 'unrated'
            elif rating < 3.0:
                return 'poor'
            elif rating < 4.5:
                return 'good'
            else:
                return 'excellent'
        
        return ratings.apply(categorize_rating)
    
    def remove_duplicates(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Remove duplicate products based on key identifying features
        """
        logger.info("Removing duplicates...")
        
        initial_count = len(df)
        
        # Define columns to use for duplicate detection
        duplicate_columns = ['name', 'model', 'company', 'type', 'price', 'vendor_id']
        available_dup_columns = [col for col in duplicate_columns if col in df.columns]
        
        if available_dup_columns:
            df = df.drop_duplicates(subset=available_dup_columns, keep='first')
        
        final_count = len(df)
        removed_count = initial_count - final_count
        
        if removed_count > 0:
            logger.info(f"Removed {removed_count} duplicate products")
        else:
            logger.info("No duplicates found")
        
        return df
    
    def validate_data_quality(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Perform comprehensive data quality validation
        """
        logger.info("Validating data quality...")
        
        quality_report = {
            'total_records': len(df),
            'missing_data': {},
            'data_types': {},
            'value_ranges': {},
            'unique_counts': {},
            'quality_score': 0
        }
        
        # Check missing data
        for col in df.columns:
            missing_count = df[col].isna().sum()
            missing_percentage = (missing_count / len(df)) * 100
            quality_report['missing_data'][col] = {
                'count': missing_count,
                'percentage': round(missing_percentage, 2)
            }
        
        # Check data types
        quality_report['data_types'] = df.dtypes.astype(str).to_dict()
        
        # Check unique counts for categorical columns
        categorical_columns = ['company', 'brand', 'type', 'price_category', 'year_category', 'rating_tier']
        for col in categorical_columns:
            if col in df.columns:
                quality_report['unique_counts'][col] = df[col].nunique()
        
        # Check value ranges for numerical columns
        numerical_columns = ['price', 'vehicleYear', 'rating', 'numReviews', 'countInStock']
        for col in numerical_columns:
            if col in df.columns and df[col].dtype in ['int64', 'float64']:
                quality_report['value_ranges'][col] = {
                    'min': float(df[col].min()) if not df[col].empty else 0,
                    'max': float(df[col].max()) if not df[col].empty else 0,
                    'mean': float(df[col].mean()) if not df[col].empty else 0
                }
        
        # Calculate overall quality score
        total_fields = len(df.columns) * len(df)
        total_missing = sum(report['count'] for report in quality_report['missing_data'].values())
        quality_score = max(0, (total_fields - total_missing) / total_fields * 100)
        quality_report['quality_score'] = round(quality_score, 2)
        
        logger.info(f"Data quality validation completed. Quality score: {quality_score:.2f}%")
        return quality_report
    
    def preprocess_dataset(self, file_path: str, output_path: Optional[str] = None) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Complete preprocessing pipeline
        """
        logger.info("Starting comprehensive data preprocessing...")
        
        # Load dataset
        df = self.load_dataset(file_path)
        
        # Validate required columns
        if not self.validate_required_columns(df):
            raise ValueError("Dataset validation failed - missing required columns")
        
        # Clean data
        df = self.clean_text_data(df)
        df = self.clean_numerical_data(df)
        df = self.clean_compatibility_data(df)
        
        # Create derived features
        df = self.create_derived_features(df)
        
        # Remove duplicates
        df = self.remove_duplicates(df)
        
        # Reset index after all operations
        df = df.reset_index(drop=True)
        
        # Validate data quality
        quality_report = self.validate_data_quality(df)
        
        # Save preprocessed dataset if output path provided
        if output_path:
            df.to_csv(output_path, index=False)
            logger.info(f"Preprocessed dataset saved to {output_path}")
        
        logger.info("Data preprocessing completed successfully")
        return df, quality_report

if __name__ == "__main__":
    # Test the preprocessor
    logger.info("Testing BikePartsDataPreprocessor...")
    
    # This would be used for testing with actual data
    # preprocessor = BikePartsDataPreprocessor()
    # df, quality_report = preprocessor.preprocess_dataset("path/to/input.csv", "path/to/output.csv")
    # print(f"Preprocessing completed. Quality score: {quality_report['quality_score']}%")