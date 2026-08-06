const fs = require('fs');
const path = require('path');

const GARMIN_URL = 'https://live.garmin.com/session/1ae7cca0-fc46-858d-97da-e1716a289601/token/2CA2AD987BDDC67CA234EADA34F8CE9';
const JSON_FILE_PATH = path.join(__dirname, '../current_location.json');

async function updateLocation() {
  try {
    console.log('Fetching Garmin LiveTrack page...');
    const response = await fetch(GARMIN_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Garmin page: ${response.statusText} (${response.status})`);
    }

    const html = await response.text();
    console.log('Successfully fetched page. Parsing HTML for track points...');

    // Find the starting index of the trackPoints array.
    // The key is stringified inside a Next.js JS payload, so quotes are escaped like \"trackPoints\":
    const index = html.search(/\\?"trackPoints\\?"\s*:\s*\[/);
    if (index === -1) {
      throw new Error('Could not find trackPoints data in the HTML page structure.');
    }

    // Locate the opening bracket of the array
    const startOfArray = html.indexOf('[', index);
    if (startOfArray === -1) {
      throw new Error('Could not find start bracket of trackPoints array.');
    }

    // Trace braces/brackets to find the exact matching closing bracket of the array
    let bracketCount = 0;
    let endOfArray = -1;

    for (let i = startOfArray; i < html.length; i++) {
      if (html[i] === '[') {
        bracketCount++;
      } else if (html[i] === ']') {
        bracketCount--;
        if (bracketCount === 0) {
          endOfArray = i + 1;
          break;
        }
      }
    }

    if (endOfArray === -1) {
      throw new Error('Could not find matching closing bracket for trackPoints array.');
    }

    const arrayString = html.substring(startOfArray, endOfArray);

    // Clean up escaped characters (e.g. \" -> " and \\/ -> /)
    const cleanedString = arrayString
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\//g, '/');

    let trackPoints;
    try {
      trackPoints = JSON.parse(cleanedString);
    } catch (parseError) {
      throw new Error(`Failed to parse extracted JSON string: ${parseError.message}`);
    }

    if (!Array.isArray(trackPoints) || trackPoints.length === 0) {
      throw new Error('Parsed trackPoints is either not an array or empty.');
    }

    const latestPoint = trackPoints[trackPoints.length - 1];
    if (!latestPoint || !latestPoint.position || latestPoint.position.lat === undefined || latestPoint.position.lon === undefined) {
      throw new Error('Latest track point is missing coordinate data.');
    }

    console.log('Found latest track point:', latestPoint);

    // Read the current local JSON configuration file
    if (!fs.existsSync(JSON_FILE_PATH)) {
      throw new Error(`current_location.json file not found at expected path: ${JSON_FILE_PATH}`);
    }

    const currentData = JSON.parse(fs.readFileSync(JSON_FILE_PATH, 'utf8'));

    // Check if the data has actually changed to prevent unnecessary commits
    const newLat = parseFloat(latestPoint.position.lat);
    const newLon = parseFloat(latestPoint.position.lon);
    const newDate = latestPoint.dateTime;

    if (
      currentData.latitude === newLat &&
      currentData.longitude === newLon &&
      currentData.date === newDate
    ) {
      console.log('Location has not changed. No updates needed.');
      return;
    }

    // Update coordinates and timestamp
    currentData.latitude = newLat;
    currentData.longitude = newLon;
    currentData.date = newDate;
    
    // Set currentMileage to null so the website calculates the completed mileage dynamically from coordinates.
    // If you ever want to force a manual override in current_location.json, you can edit it manually.
    currentData.currentMileage = null;

    // Save updated configuration back to file
    fs.writeFileSync(JSON_FILE_PATH, JSON.stringify(currentData, null, 2) + '\n', 'utf8');
    console.log('Successfully updated current_location.json with new coordinates!');

  } catch (error) {
    console.error('Error updating location:', error.message);
    process.exit(1);
  }
}

updateLocation();
