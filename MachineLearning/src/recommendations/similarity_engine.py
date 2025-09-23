"""
Similarity Engine for Smart Bike Parts Recommendation System
Handles multi-modal similarity calculation and recommendation generation
"""

import pandas as pd
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity, euclidean_distances
from scipy.spatial.distance import jaccard
import pickle
import json
from typing import Dict, List, Tuple, Any, Optional
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BikePartsSimilarityEngine:
    """
    Advanced similarity engine for bike parts recommendations
    Combines text, categorical, numerical, and compatibility features
    """
    
    def __init__(self):
        """Initialize the similarity engine"""
        self.similarity_matrix = None
        self.product_index = None
        self.feature_weights = {
            'text': 0.40,
            'categorical': 0.35,
            'compatibility': 0.25
        }
        self.business_rules = {
            'same_company_boost': 0.1,
            'same_brand_boost': 0.05,
            'price_range_factor': 0.2,  # ±20%
            'in_stock_boost': 0.05,
            'high_rating_boost': 0.03
        }
        
        # Complementary part relationships
        self.complementary_categories = {
            'Engine & Top End': {
                'direct': ['Filters', 'Fuel & Intake', 'Ignition'],
                'indirect': ['Cooling System', 'Air Intake']
            },
            'Brakes': {
                'direct': ['Wheels', 'Suspension'],
                'indirect': ['Frame & Footrests', 'Cables']
            },
            'Fuel & Intake': {
                'direct': ['Filters', 'Engine & Top End', 'Air Intake'],
                'indirect': ['Ignition', 'Cooling System']
            },
            'Electrical': {
                'direct': ['Ignition', 'Lighting', 'Instrumentation'],
                'indirect': ['Controls', 'Indicator']
            },
            'Suspension': {
                'direct': ['Brakes', 'Wheels', 'Frame & Footrests'],
                'indirect': ['Controls']
            },
            'Cooling System': {
                'direct': ['Engine & Top End', 'Fuel & Intake'],
                'indirect': ['Filters']
            },
            'Filters': {
                'direct': ['Engine & Top End', 'Fuel & Intake', 'Air Intake'],
                'indirect': ['Cooling System']
            },
            'Wheels': {
                'direct': ['Brakes', 'Suspension'],
                'indirect': ['Frame & Footrests']
            },
            'Lighting': {
                'direct': ['Electrical', 'Indicator'],
                'indirect': ['Controls']
            },
            'Cables': {
                'direct': ['Brakes', 'Controls', 'Engine & Top End'],
                'indirect': ['Electrical']
            }
        }
    
    def calculate_text_similarity(self, text_features: np.ndarray) -> np.ndarray:
        """
        Calculate cosine similarity for text features (TF-IDF)
        """
        logger.info("Calculating text similarity...")
        text_similarity = cosine_similarity(text_features)
        logger.info(f"Text similarity matrix shape: {text_similarity.shape}")
        return text_similarity
    
    def calculate_categorical_similarity(self, categorical_features: np.ndarray) -> np.ndarray:
        """
        Calculate similarity for categorical features
        """
        logger.info("Calculating categorical similarity...")
        categorical_similarity = cosine_similarity(categorical_features)
        logger.info(f"Categorical similarity matrix shape: {categorical_similarity.shape}")
        return categorical_similarity
    
    def calculate_numerical_similarity(self, numerical_features: np.ndarray) -> np.ndarray:
        """
        Calculate similarity for numerical features using inverse euclidean distance
        """
        logger.info("Calculating numerical similarity...")
        
        # Calculate euclidean distances
        distances = euclidean_distances(numerical_features)
        
        # Convert distances to similarities (higher distance = lower similarity)
        # Add small epsilon to avoid division by zero
        epsilon = 1e-8
        similarities = 1 / (1 + distances + epsilon)
        
        logger.info(f"Numerical similarity matrix shape: {similarities.shape}")
        return similarities
    
    def calculate_compatibility_similarity(self, compatibility_features: np.ndarray) -> np.ndarray:
        """
        Calculate Jaccard similarity for compatibility features
        """
        logger.info("Calculating compatibility similarity...")
        
        n_products = compatibility_features.shape[0]
        compatibility_similarity = np.zeros((n_products, n_products))
        
        for i in range(n_products):
            for j in range(i, n_products):
                # Calculate Jaccard similarity
                intersection = np.sum(compatibility_features[i] * compatibility_features[j])
                union = np.sum((compatibility_features[i] + compatibility_features[j]) > 0)
                
                if union == 0:
                    # Both products have no compatibility data
                    jaccard_sim = 0.0
                else:
                    jaccard_sim = intersection / union
                
                compatibility_similarity[i, j] = jaccard_sim
                compatibility_similarity[j, i] = jaccard_sim
        
        logger.info(f"Compatibility similarity matrix shape: {compatibility_similarity.shape}")
        return compatibility_similarity
    
    def apply_business_rules(self, similarities: np.ndarray, df: pd.DataFrame, 
                           target_idx: int) -> np.ndarray:
        """
        Apply business rules to enhance similarity scores
        """
        enhanced_similarities = similarities.copy()
        target_product = df.iloc[target_idx]
        
        for i, product in df.iterrows():
            if i == target_idx:
                continue
            
            # Same company boost
            if (product['company'] == target_product['company'] and 
                pd.notna(product['company']) and product['company'] != ''):
                enhanced_similarities[i] += self.business_rules['same_company_boost']
            
            # Same brand boost
            if (product['brand'] == target_product['brand'] and 
                pd.notna(product['brand']) and product['brand'] != ''):
                enhanced_similarities[i] += self.business_rules['same_brand_boost']
            
            # Price range similarity
            if pd.notna(product['price']) and pd.notna(target_product['price']):
                target_price = float(target_product['price'])
                product_price = float(product['price'])
                
                if target_price > 0:  # Avoid division by zero
                    price_diff = abs(product_price - target_price) / target_price
                    if price_diff <= self.business_rules['price_range_factor']:
                        # Products within 20% price range get a boost
                        price_boost = (1 - price_diff) * 0.05
                        enhanced_similarities[i] += price_boost
            
            # In stock boost
            if pd.notna(product['countInStock']) and float(product['countInStock']) > 0:
                enhanced_similarities[i] += self.business_rules['in_stock_boost']
            
            # High rating boost
            if pd.notna(product['rating']) and float(product['rating']) >= 4.0:
                enhanced_similarities[i] += self.business_rules['high_rating_boost']
        
        # Ensure similarities don't exceed 1.0
        enhanced_similarities = np.clip(enhanced_similarities, 0, 1)
        
        return enhanced_similarities
    
    def find_complementary_products(self, target_type: str, df: pd.DataFrame, 
                                  compatibility_filter: Optional[List[str]] = None) -> List[int]:
        """
        Find complementary products based on part type relationships
        """
        complementary_indices = []
        
        if target_type in self.complementary_categories:
            relationships = self.complementary_categories[target_type]
            
            # Direct complementary types (higher weight)
            direct_types = relationships.get('direct', [])
            indirect_types = relationships.get('indirect', [])
            
            for i, product in df.iterrows():
                product_type = product['type']
                
                # Check if product type is complementary
                if product_type in direct_types or product_type in indirect_types:
                    # If compatibility filter is provided, check compatibility
                    if compatibility_filter:
                        product_compatibility = self.parse_compatibility(product['compatibility'])
                        if any(comp in product_compatibility for comp in compatibility_filter):
                            complementary_indices.append(i)
                    else:
                        complementary_indices.append(i)
        
        return complementary_indices
    
    def parse_compatibility(self, compatibility_data: Any) -> List[str]:
        """
        Parse compatibility data into a list of compatible models
        """
        if pd.isna(compatibility_data) or compatibility_data == 0 or compatibility_data == '0':
            return []
        
        try:
            if isinstance(compatibility_data, str) and compatibility_data.startswith('['):
                parsed = json.loads(compatibility_data)
                return [str(item).strip().lower() for item in parsed if str(item).strip()]
            else:
                return [str(compatibility_data).strip().lower()]
        except:
            return [str(compatibility_data).strip().lower()] if str(compatibility_data).strip() else []
    
    def compute_similarity_matrix(self, features: Dict[str, np.ndarray], df: pd.DataFrame) -> np.ndarray:
        """
        Compute the combined similarity matrix from all feature types
        """
        logger.info("Computing combined similarity matrix...")
        
        # Calculate individual similarity matrices
        text_sim = self.calculate_text_similarity(features['text'])
        categorical_sim = self.calculate_categorical_similarity(features['categorical'])
        compatibility_sim = self.calculate_compatibility_similarity(features['compatibility'])
        
        # Optional: Include numerical similarity with lower weight
        numerical_sim = self.calculate_numerical_similarity(features['numerical'])
        
        # Combine similarities with weights
        combined_similarity = (
            text_sim * self.feature_weights['text'] +
            categorical_sim * self.feature_weights['categorical'] +
            compatibility_sim * self.feature_weights['compatibility'] +
            numerical_sim * 0.10  # Small weight for numerical features
        )
        
        # Normalize to [0, 1] range
        combined_similarity = np.clip(combined_similarity, 0, 1)
        
        # Store the similarity matrix in the instance
        self.similarity_matrix = combined_similarity
        
        logger.info(f"Combined similarity matrix computed. Shape: {combined_similarity.shape}")
        return combined_similarity
    
    def get_recommendations(self, product_id: str, df: pd.DataFrame, 
                          num_recommendations: int = 5,
                          include_complementary: bool = True,
                          exclude_out_of_stock: bool = False) -> List[Dict[str, Any]]:
        """
        Get product recommendations for a given product ID
        """
        logger.info(f"Getting recommendations for product: {product_id}")
        
        # Find product index
        product_indices = df[df['product_id'] == product_id].index
        if len(product_indices) == 0:
            logger.warning(f"Product {product_id} not found in dataset")
            return []
        
        target_idx = product_indices[0]
        target_product = df.iloc[target_idx]
        
        if self.similarity_matrix is None:
            logger.error("Similarity matrix not computed. Call compute_similarity_matrix first.")
            return []
        
        # Get similarities for the target product
        similarities = self.similarity_matrix[target_idx].copy()
        
        # Apply business rules
        similarities = self.apply_business_rules(similarities, df, target_idx)
        
        # Remove self-similarity
        similarities[target_idx] = 0
        
        # Filter out of stock products if requested
        if exclude_out_of_stock:
            out_of_stock_mask = (df['countInStock'].fillna(0) <= 0)
            similarities[out_of_stock_mask] = 0
        
        # Get top similar products
        top_indices = np.argsort(similarities)[::-1][:num_recommendations * 2]  # Get more for filtering
        
        recommendations = []
        
        # Add similar products
        for idx in top_indices:
            if len(recommendations) >= num_recommendations:
                break
            
            if similarities[idx] > 0:  # Only include products with positive similarity
                product = df.iloc[idx]
                recommendations.append({
                    'product_id': product['product_id'],
                    'name': product['name'],
                    'company': product['company'],
                    'brand': product['brand'],
                    'type': product['type'],
                    'price': product['price'],
                    'rating': product['rating'],
                    'similarity_score': float(similarities[idx]),
                    'recommendation_type': 'similar',
                    'reason': self.get_recommendation_reason(target_product, product, similarities[idx])
                })
        
        # Add complementary products if requested and we have space
        if include_complementary and len(recommendations) < num_recommendations:
            target_compatibility = self.parse_compatibility(target_product['compatibility'])
            complementary_indices = self.find_complementary_products(
                target_product['type'], df, target_compatibility
            )
            
            # Sort complementary products by rating and add them
            complementary_products = df.iloc[complementary_indices]
            complementary_products = complementary_products.sort_values('rating', ascending=False)
            
            for _, product in complementary_products.iterrows():
                if len(recommendations) >= num_recommendations:
                    break
                
                # Don't add if already in recommendations
                if not any(rec['product_id'] == product['product_id'] for rec in recommendations):
                    recommendations.append({
                        'product_id': product['product_id'],
                        'name': product['name'],
                        'company': product['company'],
                        'brand': product['brand'],
                        'type': product['type'],
                        'price': product['price'],
                        'rating': product['rating'],
                        'similarity_score': 0.7,  # Fixed score for complementary items
                        'recommendation_type': 'complementary',
                        'reason': f"Commonly used with {target_product['type']} parts"
                    })
        
        logger.info(f"Generated {len(recommendations)} recommendations")
        return recommendations[:num_recommendations]
    
    def get_recommendation_reason(self, target_product: pd.Series, recommended_product: pd.Series, 
                                similarity_score: float) -> str:
        """
        Generate human-readable reason for recommendation
        """
        reasons = []
        
        # Check what makes them similar
        if target_product['company'] == recommended_product['company']:
            reasons.append(f"Same brand ({target_product['company']})")
        
        if target_product['type'] == recommended_product['type']:
            reasons.append(f"Same category ({target_product['type']})")
        
        if target_product['price_category'] == recommended_product['price_category']:
            reasons.append(f"Similar price range ({target_product['price_category']})")
        
        # Check compatibility overlap
        target_compat = self.parse_compatibility(target_product['compatibility'])
        rec_compat = self.parse_compatibility(recommended_product['compatibility'])
        overlap = set(target_compat) & set(rec_compat)
        if overlap:
            reasons.append(f"Compatible with {list(overlap)[0]}")
        
        if not reasons:
            if similarity_score > 0.8:
                reasons.append("Highly similar product")
            elif similarity_score > 0.6:
                reasons.append("Similar product features")
            else:
                reasons.append("Related product")
        
        return "; ".join(reasons[:2])  # Limit to top 2 reasons
    
    def save_similarity_matrix(self, file_path: str):
        """
        Save the computed similarity matrix to disk
        """
        if self.similarity_matrix is None:
            raise ValueError("No similarity matrix to save. Compute it first.")
        
        np.save(file_path, self.similarity_matrix)
        logger.info(f"Similarity matrix saved to {file_path}")
    
    def load_similarity_matrix(self, file_path: str):
        """
        Load a pre-computed similarity matrix from disk
        """
        self.similarity_matrix = np.load(file_path)
        logger.info(f"Similarity matrix loaded from {file_path}. Shape: {self.similarity_matrix.shape}")
    
    def get_model_statistics(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Get statistics about the similarity model
        """
        if self.similarity_matrix is None:
            return {"error": "Similarity matrix not computed"}
        
        stats = {
            "matrix_shape": self.similarity_matrix.shape,
            "mean_similarity": float(np.mean(self.similarity_matrix)),
            "max_similarity": float(np.max(self.similarity_matrix)),
            "min_similarity": float(np.min(self.similarity_matrix)),
            "non_zero_similarities": int(np.count_nonzero(self.similarity_matrix)),
            "sparsity": float(np.count_nonzero(self.similarity_matrix) / self.similarity_matrix.size),
            "feature_weights": self.feature_weights,
            "business_rules": self.business_rules,
            "total_products": len(df),
            "unique_companies": df['company'].nunique(),
            "unique_types": df['type'].nunique()
        }
        
        return stats

if __name__ == "__main__":
    # Test the similarity engine
    logger.info("Testing BikePartsSimilarityEngine...")
    
    # This would be used for testing with actual data
    # engine = BikePartsSimilarityEngine()
    # similarity_matrix = engine.compute_similarity_matrix(features, df)
    # recommendations = engine.get_recommendations("product_id_123", df)
    # print("Similarity engine test completed successfully!")