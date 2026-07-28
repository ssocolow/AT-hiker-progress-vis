# Appalachian Trail Hiker Tracker 🥾

A beautiful, lightweight, and modern static tracking website designed to let family and friends track **Audrey's** progress on her northbound (NOBO) Appalachian Trail thru-hike.

Hosted easily on Vercel, the site loads instantly and is configured to be updated by editing **just a single file** (`current_location.json`).

## Features
- 🗺️ **Interactive, Zoomable Map**: Displays the entire Appalachian Trail path.
- 🟢 **Live Progress Visualization**: Splits the trail line into Completed (glowing emerald green) and Remaining (dashed slate grey) sections.
- 📈 **Stats Dashboard**: Displays miles done, miles remaining, and overall progress percentage.
- 📍 **Audrey's Current Position**: Shows her exact location with a pulsing custom marker, pop-up details, and a quick "Recenter Map" button.
- 🔗 **Google Maps Link**: One-click button to open her coordinates directly in Google Maps for satellite/street view.
- 🕒 **Timestamp & Relative Time**: Clearly displays the date/time of the last GPS ping, along with a automatically calculated relative indicator (e.g., "updated 3h ago").
- 🏆 **Interactive Milestones Timeline**: Shows key points along the trail (Springer Mountain, Smokies, Damascus, Harpers Ferry, etc.), marking them as completed, current target, or upcoming.
- 📱 **Fully Responsive Layout**: Designed to look premium and readable on both desktops and mobile devices (utilizing a sliding bottom sheet drawer for maps on mobile).

---

## How to Update Audrey's Location

To update Audrey's current position, edit the **`current_location.json`** file at the root of the repository:

```json
{
  "hikerName": "Audrey",
  "latitude": 35.725178,
  "longitude": -83.200567,
  "date": "2026-07-28T14:30:00-04:00"
}
```

### Fields to Update:
1. `latitude`: The hiker's current latitude (e.g., `44.828833`).
2. `longitude`: The hiker's current longitude (e.g., `-70.733966`).
3. `date`: The timestamp of the check-in in ISO 8601 format (e.g., `2026-07-28T14:30:00-04:00` or standard UTC). The website will automatically format this into a localized date string and calculate how long ago it was.
4. `hikerName`: Set to `"Audrey"` (can be modified if needed).
5. `direction`: The direction of the thru-hike: either `"NOBO"` (Northbound, GA ➔ ME) or `"SOBO"` (Southbound, ME ➔ GA). The website will automatically adjust all mileage calculations, progress metrics, status labels, and the milestone timeline based on this setting.

Once edited, **commit and push the changes** to your GitHub repository. Vercel will automatically redeploy the site in a few seconds!

---

## Deploying to Vercel (Step-by-Step)

### Step 1: Create a GitHub Repository
1. Go to [github.com](https://github.com) and create a new repository.
2. Initialize and push this local project to your GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Audrey's Hiker Tracker"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

### Step 2: Import into Vercel
1. Go to [vercel.com](https://vercel.com) and sign in (you can sign in with your GitHub account).
2. Click **Add New** > **Project**.
3. Import your hiker tracker repository.
4. **Project Settings**:
   - Vercel will automatically detect that this is a static project (no build configuration needed).
   - Leave the build settings as default.
5. Click **Deploy**.
6. Within seconds, your site will be live! Vercel will give you a custom subdomain (e.g., `audrey-at-tracker.vercel.app`) that you can share with family and friends.

---

## Development & Local Preview

To run the site locally:
1. Since the site fetches files asynchronously (`current_location.json` and `public/at_trail.json`), it must be run through a local web server (opening `index.html` directly in the browser via `file://` will trigger CORS security blockages).
2. Run a simple local server in this directory:
   - **Using Python**:
     ```bash
     python3 -m http.server 8080
     ```
   - **Using Node (http-server)**:
     ```bash
     npx http-server -p 8080
     ```
3. Open `http://localhost:8080` in your web browser.

---

## File Structure

```
├── AT - Track Collection Filtered 200 Ft.gpx  <- Original GPX track data
├── current_location.json                      <- Edit this to update location (coordinates + date)
├── index.html                                 <- Core structure and layout
├── style.css                                  <- Custom glassmorphic styling
├── app.js                                     <- Map loading, distance calculations, and UI logic
├── public/
│   └── at_trail.json                          <- Preprocessed and simplified trail coordinates
└── README.md                                  <- This documentation
```
# AT-hiker-progress-vis
