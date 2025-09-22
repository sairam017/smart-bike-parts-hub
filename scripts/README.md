# CSV to MongoDB Import Scripts

This directory contains scripts to import bike parts data from CSV files into MongoDB Atlas.

## Files

- `csv_to_mongodb.py` - Original import script (inserts only)
- `csv_to_mongodb_upsert.py` - **Enhanced upsert script (recommended)**
- `requirements.txt` - Python dependencies
- `run_import.bat` - Windows batch script to run the original import
- `run_upsert.bat` - **Windows batch script to run the upsert (recommended)**
- `README.md` - This file

## Setup & Usage

### Prerequisites
- Python 3.7 or higher
- Access to MongoDB Atlas (connection string in server/.env)
- Updated.csv file in the project root

### Quick Start (Windows) - RECOMMENDED UPSERT METHOD
1. Double-click `run_upsert.bat`
2. The script will:
   - Install required Python packages
   - Test upsert with first 10 rows
   - Show whether documents are updated or inserted
   - Ask for confirmation to process all data

### Original Import Method
1. Double-click `run_import.bat`
2. The script will:
   - Install required Python packages
   - Test import with first 10 rows
   - Ask for confirmation to import all data

### Manual Run
```bash
# Install dependencies
pip install -r requirements.txt

# Run the UPSERT script (recommended)
python csv_to_mongodb_upsert.py

# OR run the original import script
python csv_to_mongodb.py
```

## What the Upsert Script Does (RECOMMENDED)

1. **Connects to MongoDB Atlas** using the connection string from `server/.env`
2. **Checks for existing documents** using unique identifiers (name + model + company)
3. **Updates existing documents** with missing vendor/shop ObjectId references
4. **Inserts new documents** if not found in database
5. **Test Mode**: Processes first 10 rows for verification
6. **Full Upsert**: After confirmation, processes all data with detailed statistics
7. **Enhanced ObjectId handling**: Properly converts vendor_id/shop_id to ObjectId references
8. **Comprehensive reporting**: Shows counts of updated, inserted, unchanged, and error records

## Data Mapping

The script maps CSV columns to MongoDB fields:

| CSV Column | MongoDB Field | Notes |
|------------|---------------|-------|
| name | name | Product name |
| model | model | Vehicle model |
| company | company | Manufacturer |
| vehicleYear | vehicleYear | Manufacturing year |
| brand | brand | Brand name |
| type | type | Part category |
| countInStock | countInStock | Available quantity |
| price | price | Price in INR |
| images | images | Array of image URLs |
| description | description | Product description |
| rating | rating | Average rating |
| numReviews | numReviews | Number of reviews |
| vendor_id | vendor | ObjectId reference |
| shop_id | shop | ObjectId reference |
| created_at | createdAt | Creation timestamp |
| updated_at | updatedAt | Update timestamp |

## Features

### Upsert Script Features (RECOMMENDED):
- ✅ **Smart Document Matching**: Uses name + model + company to find existing documents
- ✅ **Update Existing**: Adds missing vendor/shop ObjectId references to existing documents
- ✅ **Insert New**: Creates new documents for data not found in database
- ✅ **Enhanced ObjectId Validation**: Properly validates and converts vendor_id/shop_id strings
- ✅ **Comprehensive Statistics**: Detailed reporting of updated/inserted/unchanged counts
- ✅ **Test Mode**: Verifies first 10 rows before full processing
- ✅ **Batch Processing**: Processes data in chunks with progress tracking
- ✅ **Error Recovery**: Continues processing even if some rows fail
- ✅ **Reference Verification**: Shows count of documents with vendor/shop references

### Original Import Script Features:
- ✅ **Batch Processing**: Processes data in chunks of 100 for better performance
- ✅ **Error Recovery**: Continues processing even if some rows fail
- ✅ **Test Mode**: Verifies first 10 rows before full import
- ✅ **Progress Tracking**: Shows real-time progress during import
- ✅ **Schema Validation**: Maps data to proper MongoDB schema
- ✅ **Date Handling**: Converts CSV dates to MongoDB datetime objects
- ✅ **ObjectId Conversion**: Handles vendor_id and shop_id conversions

## Database Details

- **Database**: `bike_parts`
- **Collection**: `bikeparts`
- **Connection**: MongoDB Atlas (from server/.env)

## Troubleshooting

### Common Issues

1. **Connection Error**: Check if MONGO_URI in server/.env is correct
2. **CSV Not Found**: Ensure Updated.csv is in the project root
3. **Permission Error**: Run command prompt as administrator
4. **Python Not Found**: Ensure Python is installed and in PATH

### Logs

The script provides detailed console output showing:
- Connection status
- Processing progress
- Error details
- Import statistics