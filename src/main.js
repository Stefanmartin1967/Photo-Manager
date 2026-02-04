import './style.css'
import exifr from 'exifr'
import * as POIManager from './modules/poiManager.js'
import * as PhotoManager from './modules/photoManager.js'
import * as UIManager from './modules/uiManager.js'

// 1. Chargement des POIs
POIManager.loadPOIs();

// 2. Initialisation UI et Callbacks
UIManager.initGallery('default-gallery', {
    onReorder: (newOrderIds) => {
        PhotoManager.reorderPhotos(newOrderIds);
    },
    onDelete: (id) => {
        PhotoManager.removePhoto(id);
    },
    getPhotos: () => PhotoManager.getPhotos()
});

// 3. Gestion des photos (Input)
document.getElementById('photoInput').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    
    for (const file of files) {
        // Lecture GPS avec exifr
        let coords = { latitude: null, longitude: null };
        try {
            coords = await exifr.gps(file) || coords;
        } catch (err) {
            console.warn("Pas de données GPS pour", file.name);
        }

        const match = POIManager.findNearestPOI(coords.latitude, coords.longitude);
        
        // Création de l'objet photo (State)
        const photoObj = PhotoManager.createPhotoObject(file, match ? match.name : null);
        
        PhotoManager.addPhoto(photoObj);

        // Ajout à l'UI
        UIManager.addPhotoCard(photoObj, {
            onDelete: (id) => PhotoManager.removePhoto(id),
            onReorder: (ids) => PhotoManager.reorderPhotos(ids),
            getPhotos: () => PhotoManager.getPhotos()
        });
    }
    // Mise à jour globale des noms
    UIManager.updatePhotoNames(PhotoManager.getPhotos());
});

// Actions des boutons
document.getElementById('saveBtn').onclick = () => {
    UIManager.triggerDownload();
};

document.getElementById('compareBtn').onclick = () => {
    const selected = UIManager.getSelectedImages();
    if (selected.length < 2 || selected.length > 4) return alert("Sélectionne entre 2 et 4 photos pour comparer");
    UIManager.showCompareModal(selected);
};

document.querySelector('.close-compare').onclick = () => {
    UIManager.closeCompareModal();
};
