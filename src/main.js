import './style.css'
import exifr from 'exifr' // Plus moderne et fiable
import Sortable from 'sortablejs'

let pois = [];
let photoList = [];

// 1. Chargement automatique du GeoJSON
async function loadPOIs() {
    try {
        const res = await fetch('/djerba.geojson');
        const data = await res.json();
        pois = data.features.map(f => ({
            name: f.properties["Nom du site FR"] || "Sans nom",
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0]
        }));
        console.log("📍 POIs chargés:", pois.length);
    } catch (e) { console.error("Erreur GeoJSON:", e); }
}

// 2. Initialisation du Drag & Drop
const galleryEl = document.getElementById('default-gallery');
new Sortable(galleryEl, { 
    animation: 150, 
    ghostClass: 'sortable-ghost',
    onEnd: () => updateNaming() 
});

// 3. Gestion des photos
document.getElementById('photoInput').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    
    for (const file of files) {
        const dataUrl = await new Promise(res => {
            const r = new FileReader(); r.onload = ev => res(ev.target.result); r.readAsDataURL(file);
        });
        
        // Lecture GPS avec exifr (beaucoup plus stable)
        let coords = { latitude: null, longitude: null };
        try {
            coords = await exifr.gps(file) || coords;
        } catch (err) {
            console.warn("Pas de données GPS pour", file.name);
        }

        const match = findNearestPOI(coords.latitude, coords.longitude);
        
        const photoObj = {
            id: 'id-' + Math.random().toString(36).substr(2, 9),
            file: file,
            dataUrl: dataUrl,
            poiName: match ? match.name : "Inconnu"
        };
        
        photoList.push(photoObj);
        addPhotoToUI(photoObj);
    }
    updateNaming();
});

function addPhotoToUI(photo) {
    const div = document.createElement('div');
    div.className = 'photo-card';
    div.id = photo.id;
    div.innerHTML = `
        <button class="delete-btn" onclick="this.parentElement.remove()">×</button>
        <img src="${photo.dataUrl}" onclick="this.parentElement.classList.toggle('selected')">
        <div class="photo-info">Calcul...</div>
        <div class="arrows">
            <span class="arrow-btn" data-dir="-1">◀</span>
            <span class="arrow-btn" data-dir="1">▶</span>
        </div>
    `;

    // Gestion des flèches
    div.querySelectorAll('.arrow-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const dir = parseInt(btn.dataset.dir);
            if (dir === -1 && div.previousElementSibling) div.parentNode.insertBefore(div, div.previousElementSibling);
            if (dir === 1 && div.nextElementSibling) div.parentNode.insertBefore(div.nextElementSibling, div);
            updateNaming();
        }
    });

    galleryEl.appendChild(div);
}

function updateNaming() {
    const counters = {};
    const cards = document.querySelectorAll('.photo-card');
    cards.forEach(card => {
        const photo = photoList.find(p => p.id === card.id);
        if (!photo) return;
        const base = photo.poiName;
        counters[base] = (counters[base] || 0) + 1;
        const finalName = `${base} - ${String(counters[base]).padStart(2, '0')}`;
        card.querySelector('.photo-info').innerText = finalName;
        card.dataset.downloadName = finalName + ".jpg";
    });
}

function findNearestPOI(lat, lon) {
    if (!lat || pois.length === 0) return null;
    let nearest = null, minDist = Infinity;
    pois.forEach(p => {
        // Formule simplifiée pour la performance
        const d = Math.sqrt(Math.pow(lat - p.lat, 2) + Math.pow(lon - p.lon, 2));
        if (d < minDist) { minDist = d; nearest = p; }
    });
    return nearest;
}

// Actions des boutons
document.getElementById('saveBtn').onclick = () => {
    document.querySelectorAll('.photo-card').forEach(card => {
        const link = document.createElement('a');
        link.href = card.querySelector('img').src;
        link.download = card.dataset.downloadName;
        link.click();
    });
};

document.getElementById('compareBtn').onclick = () => {
    const selected = document.querySelectorAll('.photo-card.selected img');
    if (selected.length < 2 || selected.length > 4) return alert("Sélectionne entre 2 et 4 photos pour comparer");
    const grid = document.getElementById('compare-grid');
    grid.innerHTML = '';
    selected.forEach(img => grid.appendChild(img.cloneNode()));
    document.getElementById('compare-modal').style.display = 'block';
};

document.querySelector('.close-compare').onclick = () => {
    document.getElementById('compare-modal').style.display = 'none';
};

loadPOIs();