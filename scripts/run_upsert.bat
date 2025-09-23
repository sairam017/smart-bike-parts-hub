@echo off
echo Smart Bike Parts Hub - CSV to MongoDB Upsert Tool
echo ==================================================
echo.

echo Installing required Python packages...
pip install -r requirements.txt

echo.
echo Starting CSV upsert process...
python csv_to_mongodb_upsert.py

echo.
pause