@echo off
echo Smart Bike Parts Hub - CSV to MongoDB Importer
echo =============================================
echo.

echo Installing required Python packages...
pip install -r requirements.txt

echo.
echo Starting CSV import process...
python csv_to_mongodb.py

echo.
pause