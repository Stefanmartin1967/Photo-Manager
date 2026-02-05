import './style.css'
import exifr from 'exifr'
import { createIcons, ImagePlus, Layers, ArrowRightLeft, Save, Share2 } from 'lucide'
import * as POIManager from './modules/poiManager.js'
import * as PhotoManager from './modules/photoManager.js'
import * as UIManager from './modules/uiManager.js'
import * as ThemeManager from './modules/themeManager.js'

(async () => {
    // 0. Initialisation Lucide Icons
    createIcons({
        icons: {
            ImagePlus,
            Layers,
            ArrowRightLeft,
            Save,
            Share2
        }
    });

    // 1. Initialisation Thème
    ThemeManager.init();

    // 2. Chargement des POIs
    await POIManager.loadPOIs();

    // 3. Initialisation UI
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

    // 4. Gestion des photos (Input)
    const photoInput = document.getElementById('photoInput');
    const addPhotoBtn = document.getElementById('addPhotoBtn');

    if (addPhotoBtn && photoInput) {
        addPhotoBtn.onclick = () => photoInput.click();
    }

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

    // Share Button Logic
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) {
        shareBtn.onclick = async () => {
            const selectedImgs = UIManager.getSelectedImages();
            if (selectedImgs.length === 0) return alert("Sélectionnez des photos à partager.");

            const allPhotos = PhotoManager.getAllPhotosFlat();
            const filesToShare = [];

            selectedImgs.forEach(img => {
                const card = img.closest('.photo-card');
                if (card) {
                    const photo = allPhotos.find(p => p.id === card.id);
                    if (photo && photo.file) {
                        filesToShare.push(photo.file);
                    }
                }
            });

            if (filesToShare.length === 0) return;

            if (navigator.share && navigator.canShare({ files: filesToShare })) {
                try {
                    await navigator.share({
                        files: filesToShare,
                        title: 'Photos Djerba',
                        text: 'Voici quelques photos...'
                    });
                } catch (error) {
                    console.error('Erreur partage:', error);
                }
            } else {
                alert("Le partage de fichiers n'est pas supporté sur ce navigateur.");
            }
        };
    }

    // Group Button Logic (Toggle Visual Only for now as logic is missing)
    const groupBtn = document.getElementById('groupBtn');
    if (groupBtn) {
        let isGrouped = false; // Default assumed state based on previous "OFF" text? Or maybe it meant "Currently OFF"?
        // Original text: "Grouper par POI : OFF". Usually means current state is OFF.
        // But code creates groups by POI by default in addPhotos.
        // Let's assume it's just a placeholder for now.

        groupBtn.onclick = () => {
            isGrouped = !isGrouped;
            // Update title
            groupBtn.title = isGrouped ? "Grouper par POI : ON" : "Grouper par POI : OFF";
            // Toggle visual state (e.g. opacity or color)
            groupBtn.style.color = isGrouped ? 'var(--brand)' : 'inherit';

            // Note: Actual logic to regroup is not implemented as it requires refactoring PhotoManager
            console.log("Grouping toggled:", isGrouped);
        };
    }

})();
