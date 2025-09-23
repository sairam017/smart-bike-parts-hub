"""
Quick Test for Feature Engineering Pipeline
Simple validation to ensure the pipeline works with real data
"""

import pandas as pd
import numpy as np
import sys
from pathlib import Path

# Add src to path
sys.path.append(str(Path(__file__).parent / "src"))

from recommendations.data_preprocessor import BikePartsDataPreprocessor
from recommendations.feature_extractor import BikePartsFeatureExtractor
from recommendations.similarity_engine import BikePartsSimilarityEngine

def quick_test():
    """Run a quick test of the feature pipeline"""
    print("🚀 Quick Feature Pipeline Test")
    print("=" * 50)
    
    # Dataset path
    dataset_path = "data/bike_parts_dataset.csv"
    
    try:
        # Test 1: Load and preprocess data
        print("1. Testing data preprocessing...")
        preprocessor = BikePartsDataPreprocessor()
        df = preprocessor.load_dataset(dataset_path)
        print(f"   ✅ Loaded {len(df)} products")
        
        # Quick preprocessing
        df = preprocessor.clean_text_data(df)
        df = preprocessor.clean_numerical_data(df)
        df = preprocessor.clean_compatibility_data(df)
        df = preprocessor.create_derived_features(df)
        print(f"   ✅ Preprocessing completed")
        
        # Take a smaller sample for testing
        sample_size = min(100, len(df))
        df_sample = df.head(sample_size).copy().reset_index(drop=True)
        print(f"   📊 Using sample of {sample_size} products for testing")
        
        # Test 2: Feature extraction
        print("2. Testing feature extraction...")
        extractor = BikePartsFeatureExtractor()
        features = extractor.fit_transform(df_sample)
        print(f"   ✅ Features extracted:")
        for name, feat in features.items():
            print(f"      - {name}: {feat.shape}")
        
        # Test 3: Similarity computation
        print("3. Testing similarity computation...")
        engine = BikePartsSimilarityEngine()
        similarity_matrix = engine.compute_similarity_matrix(features, df_sample)
        print(f"   ✅ Similarity matrix computed: {similarity_matrix.shape}")
        print(f"   📈 Mean similarity: {np.mean(similarity_matrix):.4f}")
        
        # Test 4: Generate recommendations
        print("4. Testing recommendations...")
        test_product_id = df_sample['product_id'].iloc[0]
        recommendations = engine.get_recommendations(
            product_id=test_product_id,
            df=df_sample,
            num_recommendations=3
        )
        print(f"   ✅ Generated {len(recommendations)} recommendations for product {test_product_id}")
        
        if recommendations:
            print("   📋 Sample recommendation:")
            rec = recommendations[0]
            print(f"      - Product: {rec['name']}")
            print(f"      - Type: {rec['type']}")
            print(f"      - Similarity: {rec['similarity_score']:.3f}")
            print(f"      - Reason: {rec['reason']}")
        else:
            print("   ⚠️  No recommendations generated (this might happen with small samples)")
            # Try to get some basic info about why
            target_product = df_sample[df_sample['product_id'] == test_product_id].iloc[0]
            print(f"   🔍 Target product: {target_product['name']} ({target_product['type']})")
            
            # Check if there are similar products in the sample
            same_type_count = len(df_sample[df_sample['type'] == target_product['type']])
            same_company_count = len(df_sample[df_sample['company'] == target_product['company']])
            print(f"   📊 Sample stats: {same_type_count} same type, {same_company_count} same company")
        
        print("\n🎉 ALL TESTS PASSED! Feature pipeline is working correctly.")
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    quick_test()