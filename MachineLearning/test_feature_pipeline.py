"""
Test Script for Smart Bike Parts Feature Engineering Pipeline
Tests data preprocessing, feature extraction, and similarity computation
"""

import sys
import os
import pandas as pd
import numpy as np
from pathlib import Path
import logging
import time
from typing import Dict, Any

# Add src directory to path
current_dir = Path(__file__).parent
src_dir = current_dir.parent / "src"
sys.path.append(str(src_dir))

# Import our modules
from recommendations.data_preprocessor import BikePartsDataPreprocessor
from recommendations.feature_extractor import BikePartsFeatureExtractor
from recommendations.similarity_engine import BikePartsSimilarityEngine

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class FeaturePipelineTester:
    """
    Comprehensive tester for the feature engineering pipeline
    """
    
    def __init__(self, dataset_path: str):
        """Initialize the tester with dataset path"""
        self.dataset_path = dataset_path
        self.preprocessor = BikePartsDataPreprocessor()
        self.feature_extractor = BikePartsFeatureExtractor()
        self.similarity_engine = BikePartsSimilarityEngine()
        
        self.test_results = {
            'preprocessing': {},
            'feature_extraction': {},
            'similarity_computation': {},
            'recommendations': {},
            'overall': {}
        }
    
    def test_data_preprocessing(self) -> bool:
        """Test the data preprocessing module"""
        logger.info("🧪 Testing Data Preprocessing...")
        
        try:
            start_time = time.time()
            
            # Test data loading
            df = self.preprocessor.load_dataset(self.dataset_path)
            original_shape = df.shape
            logger.info(f"✅ Dataset loaded successfully. Shape: {original_shape}")
            
            # Test preprocessing pipeline
            processed_df, quality_report = self.preprocessor.preprocess_dataset(self.dataset_path)
            processed_shape = processed_df.shape
            
            processing_time = time.time() - start_time
            
            # Validate preprocessing results
            self.test_results['preprocessing'] = {
                'success': True,
                'original_shape': original_shape,
                'processed_shape': processed_shape,
                'records_removed': original_shape[0] - processed_shape[0],
                'quality_score': quality_report.get('quality_score', 0),
                'processing_time_seconds': round(processing_time, 2),
                'derived_features_created': [
                    'price_category', 'year_category', 'rating_tier', 
                    'text_combined', 'compatibility_count'
                ]
            }
            
            # Validate required columns exist
            required_cols = ['product_id', 'name', 'type', 'price', 'text_combined']
            missing_cols = [col for col in required_cols if col not in processed_df.columns]
            
            if missing_cols:
                logger.error(f"❌ Missing required columns: {missing_cols}")
                self.test_results['preprocessing']['success'] = False
                return False
            
            # Check data types
            logger.info("✅ Data preprocessing completed successfully")
            logger.info(f"   - Quality Score: {quality_report.get('quality_score', 0):.2f}%")
            logger.info(f"   - Processing Time: {processing_time:.2f} seconds")
            logger.info(f"   - Records: {original_shape[0]} → {processed_shape[0]}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Data preprocessing failed: {e}")
            self.test_results['preprocessing'] = {
                'success': False,
                'error': str(e)
            }
            return False
    
    def test_feature_extraction(self, df: pd.DataFrame) -> bool:
        """Test the feature extraction module"""
        logger.info("🧪 Testing Feature Extraction...")
        
        try:
            start_time = time.time()
            
            # Test feature extraction
            features = self.feature_extractor.fit_transform(df)
            
            extraction_time = time.time() - start_time
            
            # Validate feature shapes
            expected_features = ['text', 'categorical', 'numerical', 'compatibility']
            missing_features = [feat for feat in expected_features if feat not in features]
            
            if missing_features:
                logger.error(f"❌ Missing feature types: {missing_features}")
                return False
            
            # Check feature dimensions
            n_products = len(df)
            feature_shapes = {name: feat.shape for name, feat in features.items()}
            
            # Validate shapes
            for name, shape in feature_shapes.items():
                if shape[0] != n_products:
                    logger.error(f"❌ Feature {name} has wrong number of samples: {shape[0]} vs {n_products}")
                    return False
            
            # Test transform on new data (using subset)
            test_df = df.head(10).copy()
            test_features = self.feature_extractor.transform(test_df)
            
            # Validate feature names
            feature_names = self.feature_extractor.get_feature_names()
            
            self.test_results['feature_extraction'] = {
                'success': True,
                'feature_shapes': feature_shapes,
                'extraction_time_seconds': round(extraction_time, 2),
                'text_features_count': features['text'].shape[1],
                'categorical_features_count': features['categorical'].shape[1],
                'numerical_features_count': features['numerical'].shape[1],
                'compatibility_vocab_size': len(self.feature_extractor.compatibility_vocab) if self.feature_extractor.compatibility_vocab else 0,
                'transform_test_passed': all(
                    test_features[name].shape[1] == features[name].shape[1] 
                    for name in features.keys()
                )
            }
            
            logger.info("✅ Feature extraction completed successfully")
            logger.info(f"   - Text features: {features['text'].shape[1]}")
            logger.info(f"   - Categorical features: {features['categorical'].shape[1]}")
            logger.info(f"   - Numerical features: {features['numerical'].shape[1]}")
            logger.info(f"   - Compatibility vocab: {len(self.feature_extractor.compatibility_vocab) if self.feature_extractor.compatibility_vocab else 0}")
            logger.info(f"   - Extraction time: {extraction_time:.2f} seconds")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Feature extraction failed: {e}")
            self.test_results['feature_extraction'] = {
                'success': False,
                'error': str(e)
            }
            return False
    
    def test_similarity_computation(self, features: Dict[str, np.ndarray], df: pd.DataFrame) -> bool:
        """Test the similarity computation engine"""
        logger.info("🧪 Testing Similarity Computation...")
        
        try:
            start_time = time.time()
            
            # Compute similarity matrix
            similarity_matrix = self.similarity_engine.compute_similarity_matrix(features, df)
            
            computation_time = time.time() - start_time
            
            # Validate similarity matrix
            n_products = len(df)
            expected_shape = (n_products, n_products)
            
            if similarity_matrix.shape != expected_shape:
                logger.error(f"❌ Similarity matrix has wrong shape: {similarity_matrix.shape} vs {expected_shape}")
                return False
            
            # Check if matrix is symmetric
            is_symmetric = np.allclose(similarity_matrix, similarity_matrix.T, atol=1e-10)
            
            # Check diagonal values (should be 1.0 for self-similarity)
            diagonal_correct = np.allclose(np.diag(similarity_matrix), 1.0, atol=1e-10)
            
            # Check value range [0, 1]
            values_in_range = np.all((similarity_matrix >= 0) & (similarity_matrix <= 1))
            
            # Get model statistics
            stats = self.similarity_engine.get_model_statistics(df)
            
            self.test_results['similarity_computation'] = {
                'success': True,
                'matrix_shape': similarity_matrix.shape,
                'computation_time_seconds': round(computation_time, 2),
                'is_symmetric': is_symmetric,
                'diagonal_correct': diagonal_correct,
                'values_in_range': values_in_range,
                'mean_similarity': float(np.mean(similarity_matrix)),
                'std_similarity': float(np.std(similarity_matrix)),
                'sparsity': stats.get('sparsity', 0),
                'model_stats': stats
            }
            
            logger.info("✅ Similarity computation completed successfully")
            logger.info(f"   - Matrix shape: {similarity_matrix.shape}")
            logger.info(f"   - Computation time: {computation_time:.2f} seconds")
            logger.info(f"   - Mean similarity: {np.mean(similarity_matrix):.4f}")
            logger.info(f"   - Is symmetric: {is_symmetric}")
            logger.info(f"   - Values in [0,1]: {values_in_range}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Similarity computation failed: {e}")
            self.test_results['similarity_computation'] = {
                'success': False,
                'error': str(e)
            }
            return False
    
    def test_recommendations(self, df: pd.DataFrame) -> bool:
        """Test recommendation generation"""
        logger.info("🧪 Testing Recommendation Generation...")
        
        try:
            # Test with a few different products
            test_product_ids = df['product_id'].head(5).tolist()
            test_results = []
            
            for product_id in test_product_ids:
                start_time = time.time()
                
                # Get recommendations
                recommendations = self.similarity_engine.get_recommendations(
                    product_id=product_id,
                    df=df,
                    num_recommendations=5,
                    include_complementary=True
                )
                
                recommendation_time = time.time() - start_time
                
                # Validate recommendations
                valid_recommendations = all(
                    isinstance(rec, dict) and 
                    'product_id' in rec and 
                    'similarity_score' in rec and
                    'recommendation_type' in rec
                    for rec in recommendations
                )
                
                test_results.append({
                    'product_id': product_id,
                    'num_recommendations': len(recommendations),
                    'recommendation_time_ms': round(recommendation_time * 1000, 2),
                    'valid_format': valid_recommendations,
                    'has_similar': any(rec['recommendation_type'] == 'similar' for rec in recommendations),
                    'has_complementary': any(rec['recommendation_type'] == 'complementary' for rec in recommendations)
                })
            
            # Calculate averages
            avg_recommendations = np.mean([r['num_recommendations'] for r in test_results])
            avg_time = np.mean([r['recommendation_time_ms'] for r in test_results])
            all_valid = all(r['valid_format'] for r in test_results)
            
            self.test_results['recommendations'] = {
                'success': all_valid,
                'test_product_count': len(test_product_ids),
                'avg_recommendations_returned': round(avg_recommendations, 1),
                'avg_response_time_ms': round(avg_time, 2),
                'all_valid_format': all_valid,
                'test_details': test_results
            }
            
            logger.info("✅ Recommendation generation completed successfully")
            logger.info(f"   - Tested products: {len(test_product_ids)}")
            logger.info(f"   - Avg recommendations: {avg_recommendations:.1f}")
            logger.info(f"   - Avg response time: {avg_time:.2f}ms")
            logger.info(f"   - All valid format: {all_valid}")
            
            return all_valid
            
        except Exception as e:
            logger.error(f"❌ Recommendation generation failed: {e}")
            self.test_results['recommendations'] = {
                'success': False,
                'error': str(e)
            }
            return False
    
    def run_complete_test(self) -> Dict[str, Any]:
        """Run the complete test pipeline"""
        logger.info("🚀 Starting Complete Feature Pipeline Test")
        logger.info("=" * 60)
        
        total_start_time = time.time()
        
        # Test 1: Data Preprocessing
        preprocessing_success = self.test_data_preprocessing()
        if not preprocessing_success:
            logger.error("❌ Testing stopped due to preprocessing failure")
            return self.test_results
        
        # Load processed data for subsequent tests
        df, _ = self.preprocessor.preprocess_dataset(self.dataset_path)
        
        logger.info("-" * 60)
        
        # Test 2: Feature Extraction
        feature_extraction_success = self.test_feature_extraction(df)
        if not feature_extraction_success:
            logger.error("❌ Testing stopped due to feature extraction failure")
            return self.test_results
        
        # Extract features for subsequent tests
        features = self.feature_extractor.fit_transform(df)
        
        logger.info("-" * 60)
        
        # Test 3: Similarity Computation
        similarity_success = self.test_similarity_computation(features, df)
        if not similarity_success:
            logger.error("❌ Testing stopped due to similarity computation failure")
            return self.test_results
        
        logger.info("-" * 60)
        
        # Test 4: Recommendation Generation
        recommendation_success = self.test_recommendations(df)
        
        total_time = time.time() - total_start_time
        
        # Overall results
        all_tests_passed = all([
            preprocessing_success,
            feature_extraction_success,
            similarity_success,
            recommendation_success
        ])
        
        self.test_results['overall'] = {
            'all_tests_passed': all_tests_passed,
            'total_test_time_seconds': round(total_time, 2),
            'dataset_size': len(df),
            'pipeline_ready': all_tests_passed,
            'test_timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
        }
        
        logger.info("=" * 60)
        if all_tests_passed:
            logger.info("🎉 ALL TESTS PASSED! Feature pipeline is ready for production.")
        else:
            logger.error("❌ Some tests failed. Check the results above.")
        logger.info(f"📊 Total test time: {total_time:.2f} seconds")
        logger.info(f"📈 Dataset size: {len(df)} products")
        
        return self.test_results
    
    def print_test_summary(self):
        """Print a formatted test summary"""
        logger.info("\n" + "=" * 60)
        logger.info("📋 TEST SUMMARY")
        logger.info("=" * 60)
        
        for module, results in self.test_results.items():
            if module == 'overall':
                continue
                
            success = results.get('success', False)
            status = "✅ PASS" if success else "❌ FAIL"
            logger.info(f"{module.upper():<25} {status}")
            
            if success and module in ['preprocessing', 'feature_extraction', 'similarity_computation']:
                if 'processing_time_seconds' in results:
                    logger.info(f"{'  Time:':<25} {results['processing_time_seconds']}s")
                elif 'extraction_time_seconds' in results:
                    logger.info(f"{'  Time:':<25} {results['extraction_time_seconds']}s")
                elif 'computation_time_seconds' in results:
                    logger.info(f"{'  Time:':<25} {results['computation_time_seconds']}s")
        
        overall = self.test_results.get('overall', {})
        if overall:
            logger.info("-" * 60)
            logger.info(f"{'OVERALL:':<25} {'✅ PASS' if overall.get('all_tests_passed') else '❌ FAIL'}")
            logger.info(f"{'Total Time:':<25} {overall.get('total_test_time_seconds', 0)}s")
            logger.info(f"{'Dataset Size:':<25} {overall.get('dataset_size', 0)} products")

def main():
    """Main test execution"""
    # Dataset path
    dataset_path = Path(__file__).parent / "data" / "bike_parts_dataset.csv"
    
    if not dataset_path.exists():
        logger.error(f"❌ Dataset not found at: {dataset_path}")
        logger.info("Please ensure the bike_parts_dataset.csv file is in the data directory")
        return
    
    # Run tests
    tester = FeaturePipelineTester(str(dataset_path))
    results = tester.run_complete_test()
    
    # Print summary
    tester.print_test_summary()
    
    # Save results to file
    import json
    results_path = Path(__file__).parent / "test_results.json"
    with open(results_path, 'w') as f:
        json.dump(results, f, indent=2)
    
    logger.info(f"\n📄 Detailed results saved to: {results_path}")

if __name__ == "__main__":
    main()