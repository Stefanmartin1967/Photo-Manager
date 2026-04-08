import { calculateHaversineDistance } from './utils.js';

let pois = [];

export async function loadPOIs() {
    try {
        const res = await fetch('https://raw.githubusercontent.com/Stefanmartin1967/History-Walk-V1/main/public/djerba.geojson');
        const data = await res.json();
        pois = data.features.map(f => ({
            name: f.properties["Nom du site FR"] || "Sans nom",
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0]
        }));
    } catch (e) { console.error("Erreur GeoJSON:", e); }
}

export function findNearestPOI(lat, lon) {
    if (!lat || pois.length === 0) return null;
    let nearest = null, minDist = Infinity;
    pois.forEach(p => {
        const d = calculateHaversineDistance(lat, lon, p.lat, p.lon);
        if (d < minDist) { minDist = d; nearest = p; }
    });
    return nearest;
}

export function getPois() {
    return pois;
}

const osmCache = new Map();

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // mètres
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(dp/2) * Math.sin(dp/2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl/2) * Math.sin(dl/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

export async function fetchOSMPlaceName(lat, lon) {
    if (!lat || !lon) return null;

    // Arrondir les coordonnées pour le cache (environ 100m de précision)
    const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    if (osmCache.has(cacheKey)) {
        return osmCache.get(cacheKey);
    }

    try {
        // Use Overpass API to find named POIs within 50 meters
        const query = `
[out:json];
(
  nwr(around:50, ${lat}, ${lon})["name"]["tourism"];
  nwr(around:50, ${lat}, ${lon})["name"]["historic"];
  nwr(around:50, ${lat}, ${lon})["name"]["amenity"];
  nwr(around:50, ${lat}, ${lon})["name"]["leisure"];
  nwr(around:50, ${lat}, ${lon})["name"]["building"];
);
out center;
        `;

        const url = `https://overpass-api.de/api/interpreter`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `data=${encodeURIComponent(query)}`
        });

        if (!response.ok) {
            console.warn(`OSM API error: ${response.status}`);
            osmCache.set(cacheKey, null);
            return null;
        }

        const data = await response.json();

        if (data && data.elements && data.elements.length > 0) {
            let nearestPoi = null;
            let minDist = Infinity;

            for (const el of data.elements) {
                const elLat = el.lat || (el.center && el.center.lat);
                const elLon = el.lon || (el.center && el.center.lon);

                if (elLat && elLon) {
                    const dist = getDistance(lat, lon, elLat, elLon);
                    if (dist < minDist && el.tags && el.tags.name) {
                        minDist = dist;
                        nearestPoi = el;
                    }
                }
            }

            if (nearestPoi && nearestPoi.tags.name) {
                const placeName = nearestPoi.tags.name;
                osmCache.set(cacheKey, placeName);
                return placeName;
            }
        }

        osmCache.set(cacheKey, null);
        return null;

    } catch (e) {
        console.warn("Erreur OSM Overpass:", e);
        osmCache.set(cacheKey, null);
        return null;
    }
}
