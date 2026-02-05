import './style.css'
import exifr from 'exifr'
import * as POIManager from './modules/poiManager.js'
import * as PhotoManager from './modules/photoManager.js'
import * as UIManager from './modules/uiManager.js'

(async () => {
    // 1. Chargement des POIs
    await POIManager.loadPOIs();

    // 2. Initialisation UI
    UIManager.initGallery('default-gallery', {
        onMove: (photoId, targetGroupId, newIndex) => {
            PhotoManager.movePhoto(photoId, targetGroupId, newIndex);
            UIManager.updateUI(PhotoManager.getGroups());
        },
        onRenameGroup: (groupId, newName) => {
            PhotoManager.renameGroup(groupId, newName);
            UIManager.updateUI(PhotoManager.getGroups());
        },
        onRenamePhoto: (photoId, newName) => {
            PhotoManager.renamePhoto(photoId, newName);
            UIManager.updateUI(PhotoManager.getGroups());
        },
        onExtract: (photoId) => {
            PhotoManager.extractToTrajet(photoId);
            UIManager.updateUI(PhotoManager.getGroups());
        },
        onDelete: (photoId) => {
            PhotoManager.removePhoto(photoId);
            UIManager.updateUI(PhotoManager.getGroups());
        }
    });

    // 3. Gestion des photos (Input)
    const photoInput = document.getElementById('photoInput');
    if (photoInput) {
        photoInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            const newPhotos = [];

            for (const file of files) {
                let date = null;
                let lat = null;
                let lon = null;

                try {
                    const data = await exifr.parse(file);
                    if (data) {
                        date = data.DateTimeOriginal || data.CreateDate || null;
                        lat = data.latitude;
                        lon = data.longitude;
                    }
                } catch (err) {
                    console.warn("Pas de métadonnées pour", file.name);
                }

                const photoObj = PhotoManager.createPhotoObject(file, date, lat, lon);
                newPhotos.push(photoObj);
            }

            PhotoManager.addPhotos(newPhotos, POIManager.getPois());
            UIManager.updateUI(PhotoManager.getGroups());

            e.target.value = ''; // Reset input
        });
    }

    // Actions des boutons
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.onclick = () => {
            UIManager.triggerDownload();
        };
    }

    const compareBtn = document.getElementById('compareBtn');
    if (compareBtn) {
        compareBtn.onclick = () => {
            const selected = UIManager.getSelectedImages();
            if (selected.length < 2 || selected.length > 4) return alert("Sélectionne entre 2 et 4 photos pour comparer");
            UIManager.showCompareModal(selected);
        };
    }

    const closeCompare = document.querySelector('.close-compare');
    if (closeCompare) {
        closeCompare.onclick = () => {
            UIManager.closeCompareModal();
        };
    }
})();
