"""
Smart Bike Parts Recommendation System
Feature Engineering and ML Pipeline

This module provides comprehensive recommendation capabilities including:
- Data preprocessing and cleaning
- Multi-modal feature extraction (text, categorical, numerical, compatibility)
- Similarity computation with business rules
- Product recommendation generation

Main Components:
- BikePartsDataPreprocessor: Clean and prepare data
- BikePartsFeatureExtractor: Extract ML features
- BikePartsSimilarityEngine: Compute similarities and generate recommendations
"""

from .data_preprocessor import BikePartsDataPreprocessor
from .feature_extractor import BikePartsFeatureExtractor
from .similarity_engine import BikePartsSimilarityEngine

__version__ = "1.0.0"
__author__ = "Smart Bike Parts Hub Team"

__all__ = [
    "BikePartsDataPreprocessor",
    "BikePartsFeatureExtractor", 
    "BikePartsSimilarityEngine"
]