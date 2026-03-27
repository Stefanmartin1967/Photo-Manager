import { calculateHaversineDistance } from './utils.js';

let pois = [];

export async function loadPOIs() {
    try {
        const res = await fetch(import.meta.env.BASE_URL + 'djerba.geojson');
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

export async function fetchOSMPlaceName(lat, lon) {
    if (!lat || !lon) return null;

    // Arrondir les coordonnées pour le cache (environ 100m de précision)
    const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    if (osmCache.has(cacheKey)) {
        return osmCache.get(cacheKey);
    }

    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;

        // Add a small delay to respect Nominatim's usage policy (max 1 request/sec)
        // In a real app with many photos, we should ideally batch or queue these,
        // but for now, simple caching + fetch should help.

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'DjerbaPhotoManager/1.0 (Contact: local)' // Required by Nominatim policy
            }
        });

        if (!response.ok) {
            console.warn(`OSM API error: ${response.status}`);
            osmCache.set(cacheKey, null);
            return null;
        }

        const data = await response.json();

        if (data && data.address) {
            // Extract the most relevant name
            const addr = data.address;
            const placeName = addr.amenity || addr.tourism || addr.historic || addr.leisure || addr.building || addr.road || addr.village || addr.town || addr.city || addr.suburb || null;

            osmCache.set(cacheKey, placeName);
            return placeName;
        }

        osmCache.set(cacheKey, null);
        return null;

    } catch (e) {
        console.warn("Erreur Nominatim OSM:", e);
        osmCache.set(cacheKey, null);
        return null;
    }
}
