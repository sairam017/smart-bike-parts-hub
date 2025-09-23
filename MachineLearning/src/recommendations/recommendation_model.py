"""
Complete Recommendation Model for Smart Bike Parts Hub
Integrates all components for production use
"""

import pandas as pd
import numpy as np
import pickle
import json
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

from .data_preprocessor import BikePartsDataPreprocessor
from .feature_extractor import BikePartsFeatureExtractor
from .similarity_engine import BikePartsSimilarityEngine

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BikePartsRecommendationModel:
    """
    Complete recommendation model that handles the full pipeline
    from data loading to recommendation generation
    """
    
    def __init__(self, model_dir: str = "models"):
        """Initialize the recommendation model"""
        self.model_dir = Path(model_dir)
        self.model_dir.mkdir(exist_ok=True)
        
        # Initialize components
        self.preprocessor = BikePartsDataPreprocessor()
        self.feature_extractor = BikePartsFeatureExtractor()
        self.similarity_engine = BikePartsSimilarityEngine()
        
        # Model state
        self.is_trained = False
        self.model_version = "1.0.0"
        self.training_metadata = {}
        self.df = None
        
    def train_model(self, dataset_path: str, force_retrain: bool = False) -> Dict[str, Any]:
        """
        Train the recommendation model with the provided dataset
        """
        logger.info("🚀 Starting recommendation model training...")
        start_time = datetime.now()
        
        try:
            # Check if model already exists and is recent
            model_info_path = self.model_dir / "model_info.json"
            if model_info_path.exists() and not force_retrain:
                with open(model_info_path, 'r') as f:
                    existing_info = json.load(f)
                logger.info(f"Model already exists (version {existing_info.get('version', 'unknown')})")
                logger.info("Loading existing model components...")
                
                # Load the existing model
                if self.load_model():
                    logger.info("✅ Existing model loaded successfully")
                    return existing_info
                else:
                    logger.warning("Failed to load existing model, retraining...")
                    # Continue with training if loading fails
            
            # Step 1: Preprocess data
            logger.info("📊 Preprocessing data...")
            self.df, quality_report = self.preprocessor.preprocess_dataset(dataset_path)
            logger.info(f"   ✅ Preprocessed {len(self.df)} products (Quality: {quality_report['quality_score']:.1f}%)")
            
            # Step 2: Extract features
            logger.info("🔧 Extracting features...")
            features = self.feature_extractor.fit_transform(self.df)
            logger.info(f"   ✅ Extracted features:")
            for name, feat in features.items():
                logger.info(f"      - {name}: {feat.shape}")
            
            # Step 3: Compute similarity matrix
            logger.info("🧠 Computing similarity matrix...")
            similarity_matrix = self.similarity_engine.compute_similarity_matrix(features, self.df)
            logger.info(f"   ✅ Similarity matrix: {similarity_matrix.shape}")
            
            # Step 4: Save model components
            logger.info("💾 Saving model components...")
            
            # Save feature extractors
            self.feature_extractor.save_extractors(str(self.model_dir / "extractors"))
            
            # Save similarity matrix
            self.similarity_engine.save_similarity_matrix(str(self.model_dir / "similarity_matrix.npy"))
            
            # Save processed dataframe
            self.df.to_csv(self.model_dir / "processed_data.csv", index=False)
            
            # Save model metadata
            training_time = (datetime.now() - start_time).total_seconds()
            
            model_info = {
                "version": self.model_version,
                "training_date": start_time.isoformat(),
                "training_time_seconds": training_time,
                "dataset_size": len(self.df),
                "feature_shapes": {name: list(feat.shape) for name, feat in features.items()},
                "similarity_matrix_shape": list(similarity_matrix.shape),
                "quality_score": quality_report["quality_score"],
                "model_stats": self.similarity_engine.get_model_statistics(self.df)
            }
            
            with open(model_info_path, 'w') as f:
                json.dump(model_info, f, indent=2)
            
            self.is_trained = True
            self.training_metadata = model_info
            
            logger.info("🎉 Model training completed successfully!")
            logger.info(f"   📈 Training time: {training_time:.2f} seconds")
            logger.info(f"   📊 Products: {len(self.df)}")
            logger.info(f"   💾 Model saved to: {self.model_dir}")
            
            return model_info
            
        except Exception as e:
            logger.error(f"❌ Model training failed: {e}")
            raise
    
    def load_model(self) -> bool:
        """
        Load a pre-trained model from disk
        """
        logger.info("📥 Loading recommendation model...")
        
        try:
            # Check if model exists
            model_info_path = self.model_dir / "model_info.json"
            if not model_info_path.exists():
                logger.error("❌ Model not found. Train the model first.")
                return False
            
            # Load model info
            with open(model_info_path, 'r') as f:
                self.training_metadata = json.load(f)
            
            # Check if all required files exist
            required_files = [
                self.model_dir / "extractors" / "tfidf_vectorizer.pkl",
                self.model_dir / "similarity_matrix.npy",
                self.model_dir / "processed_data.csv"
            ]
            
            missing_files = [f for f in required_files if not f.exists()]
            if missing_files:
                logger.error(f"❌ Missing model files: {[str(f) for f in missing_files]}")
                return False
            
            # Load feature extractors
            self.feature_extractor.load_extractors(str(self.model_dir / "extractors"))
            
            # Load similarity matrix
            self.similarity_engine.load_similarity_matrix(str(self.model_dir / "similarity_matrix.npy"))
            
            # Load processed data
            self.df = pd.read_csv(self.model_dir / "processed_data.csv")
            
            self.is_trained = True
            
            logger.info("✅ Model loaded successfully!")
            logger.info(f"   📅 Trained: {self.training_metadata.get('training_date', 'unknown')}")
            logger.info(f"   📊 Products: {len(self.df)}")
            logger.info(f"   🎯 Version: {self.training_metadata.get('version', 'unknown')}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Model loading failed: {e}")
            return False
    
    def get_recommendations(self, product_id: str, 
                          num_recommendations: int = 5,
                          include_complementary: bool = True,
                          exclude_out_of_stock: bool = False) -> List[Dict[str, Any]]:
        """
        Get product recommendations for a given product ID
        """
        if not self.is_trained:
            raise ValueError("Model not trained. Call train_model() or load_model() first.")
        
        recommendations = self.similarity_engine.get_recommendations(
            product_id=product_id,
            df=self.df,
            num_recommendations=num_recommendations,
            include_complementary=include_complementary,
            exclude_out_of_stock=exclude_out_of_stock
        )
        
        return recommendations
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about the current model
        """
        if not self.is_trained:
            return {"status": "not_trained", "message": "Model not loaded or trained"}
        
        return {
            "status": "ready",
            "is_trained": self.is_trained,
            "version": self.model_version,
            "metadata": self.training_metadata,
            "dataset_size": len(self.df) if self.df is not None else 0,
            "model_dir": str(self.model_dir)
        }
    
    def update_with_new_product(self, product_data: Dict[str, Any]) -> bool:
        """
        Add a new product to the model (incremental update)
        Note: This is a simplified version. For production, consider retraining periodically.
        """
        if not self.is_trained:
            logger.error("Model not trained. Cannot add new product.")
            return False
        
        try:
            # Convert product data to DataFrame
            new_df = pd.DataFrame([product_data])
            
            # Preprocess the new product
            new_df = self.preprocessor.clean_text_data(new_df)
            new_df = self.preprocessor.clean_numerical_data(new_df)
            new_df = self.preprocessor.clean_compatibility_data(new_df)
            new_df = self.preprocessor.create_derived_features(new_df)
            
            # Add to existing dataframe
            self.df = pd.concat([self.df, new_df], ignore_index=True)
            
            # Note: Similarity matrix would need to be recomputed for full accuracy
            # For now, we just add the product to the dataframe
            logger.info(f"✅ Added new product: {product_data.get('name', 'Unknown')}")
            logger.info("⚠️  Note: Similarity matrix not updated. Consider retraining for full accuracy.")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to add new product: {e}")
            return False
    
    def search_products(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Search products by text query
        """
        if not self.is_trained:
            raise ValueError("Model not trained. Call train_model() or load_model() first.")
        
        # Simple text search in product names and descriptions
        query_lower = query.lower()
        
        matching_products = []
        for _, product in self.df.iterrows():
            # Check if query matches name, type, company, or description
            search_text = f"{product.get('name', '')} {product.get('type', '')} {product.get('company', '')} {product.get('description', '')}".lower()
            
            if query_lower in search_text:
                matching_products.append({
                    'product_id': product['product_id'],
                    'name': product['name'],
                    'company': product['company'],
                    'type': product['type'],
                    'price': product['price'],
                    'rating': product['rating']
                })
        
        return matching_products[:limit]

# Global model instance
_recommendation_model = None

def get_recommendation_model(model_dir: str = "models") -> BikePartsRecommendationModel:
    """
    Get or create the global recommendation model instance
    """
    global _recommendation_model
    if _recommendation_model is None:
        _recommendation_model = BikePartsRecommendationModel(model_dir)
    return _recommendation_model

if __name__ == "__main__":
    # Example usage
    model = BikePartsRecommendationModel()
    
    # Train the model
    dataset_path = "data/bike_parts_dataset.csv"
    model.train_model(dataset_path)
    
    # Get recommendations for a product
    df = pd.read_csv("models/processed_data.csv")
    sample_product_id = df['product_id'].iloc[0]
    recommendations = model.get_recommendations(sample_product_id, num_recommendations=5)
    
    print(f"\nRecommendations for product {sample_product_id}:")
    for i, rec in enumerate(recommendations, 1):
        print(f"{i}. {rec['name']} (Score: {rec['similarity_score']:.3f})")
        print(f"   Reason: {rec['reason']}")
        print()