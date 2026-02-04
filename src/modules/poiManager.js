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
        console.log("📍 POIs chargés:", pois.length);
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
