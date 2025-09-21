"""
Main entry point for the Smart Bike Parts ML Service
Run this file to start the FastAPI server: python main.py
"""
import uvicorn
import sys
from pathlib import Path

# Add the src directory to Python path
current_dir = Path(__file__).parent
src_dir = current_dir / "src"
sys.path.append(str(src_dir))

if __name__ == "__main__":
    print("🚀 Starting Smart Bike Parts ML Service on http://localhost:8010")
    uvicorn.run(
        "src.api_service:app",
        host="127.0.0.1",
        port=8010,
        reload=True
    )