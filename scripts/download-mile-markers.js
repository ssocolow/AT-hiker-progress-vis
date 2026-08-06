const fs = require('fs');
const path = require('path');

const ARCGIS_BASE_URL = 'https://services9.arcgis.com/Nb3RpWJ36xRlYQj2/arcgis/rest/services/Half_Mile_Points040726_NoM/FeatureServer/18/query';
const OUTPUT_FILE_PATH = path.join(__dirname, '../public/mile_markers.json');

async function downloadMileMarkers() {
  let allFeatures = [];
  let offset = 0;
  const limit = 2000;
  let hasMore = true;

  console.log('Starting download of GPS mile marking points from ArcGIS REST service...');

  while (hasMore) {
    // Construct query parameters
    const params = new URLSearchParams({
      where: '1=1',
      outSR: '4326', // Request standard WGS84 Lat/Lon coordinates
      outFields: 'Point_ID,Measure', // Only request the fields we need
      f: 'geojson', // Request GeoJSON format
      resultOffset: offset.toString(),
      resultRecordCount: limit.toString()
    });

    const url = `${ARCGIS_BASE_URL}?${params.toString()}`;
    console.log(`Fetching records with offset ${offset}...`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const geojson = await response.json();
      const features = geojson.features || [];
      
      allFeatures = allFeatures.concat(features);
      console.log(`Retrieved ${features.length} features. Total so far: ${allFeatures.length}`);

      if (features.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    } catch (error) {
      console.error('Error during download:', error.message);
      process.exit(1);
    }
  }

  console.log(`Downloaded ${allFeatures.length} points. Formatting data...`);

  // Map features to a clean and lightweight structure
  const formattedMarkers = allFeatures
    .map(f => {
      const coordinates = f.geometry && f.geometry.coordinates;
      const properties = f.properties || {};
      
      if (!coordinates || coordinates.length < 2) return null;
      
      return {
        mile: parseFloat(properties.Measure),
        lat: parseFloat(coordinates[1]), // GeoJSON is [lon, lat]
        lon: parseFloat(coordinates[0])
      };
    })
    .filter(marker => marker !== null && !isNaN(marker.mile));

  // Sort by mile marker ascending
  formattedMarkers.sort((a, b) => a.mile - b.mile);

  // Write to output file
  try {
    const parentDir = path.dirname(OUTPUT_FILE_PATH);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE_PATH, JSON.stringify(formattedMarkers, null, 2) + '\n', 'utf8');
    console.log(`Successfully saved ${formattedMarkers.length} sorted mile markers to ${OUTPUT_FILE_PATH}`);
  } catch (error) {
    console.error('Error writing file:', error.message);
    process.exit(1);
  }
}

downloadMileMarkers();
