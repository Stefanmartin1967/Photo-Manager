import './style.css'
import exifr from 'exifr'
import { createIcons, ImagePlus, Layers, ArrowRightLeft, Save, Share2, Minus, Plus } from 'lucide'
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
            Share2,
            Minus,
            Plus
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
            UIManager.renderGallery(PhotoManager.getGroups());
        },
        onRenameGroup: (groupId, newName) => {
            PhotoManager.renameGroup(groupId, newName);
            UIManager.renderGallery(PhotoManager.getGroups());
        },
        onRenamePhoto: (photoId, newName) => {
            PhotoManager.renamePhoto(photoId, newName);
            UIManager.renderGallery(PhotoManager.getGroups());
        },
        onExtract: (photoId) => {
            PhotoManager.extractToTrajet(photoId);
            UIManager.renderGallery(PhotoManager.getGroups());
        },
        onDelete: (photoId) => {
            PhotoManager.removePhoto(photoId);
            UIManager.renderGallery(PhotoManager.getGroups());
        }
    });

    // 4. Radius Control Logic
    const radiusInput = document.getElementById('radiusInput');
    const radiusMinus = document.getElementById('radiusMinus');
    const radiusPlus = document.getElementById('radiusPlus');

    const updateRadius = (newVal) => {
        const val = parseInt(newVal);
        if (isNaN(val) || val < 0) return;

        PhotoManager.setGroupingRadius(val);
        radiusInput.value = val;

        // Re-cluster
        PhotoManager.reorganizeAllPhotos(POIManager.getPois());
        UIManager.renderGallery(PhotoManager.getGroups());
    };

    if (radiusInput && radiusMinus && radiusPlus) {
        // Init default
        radiusInput.value = PhotoManager.getGroupingRadius();

        radiusMinus.onclick = () => {
            const current = parseInt(radiusInput.value) || 0;
            updateRadius(Math.max(0, current - 50));
        };

        radiusPlus.onclick = () => {
            const current = parseInt(radiusInput.value) || 0;
            updateRadius(current + 50);
        };

        radiusInput.onchange = () => {
            updateRadius(radiusInput.value);
        };
    }

    // 5. Gestion des photos (Input)
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
                    // Force reading GPS data to ensure mobile devices extract it correctly
                    // Use ArrayBuffer to bypass potential Blob.slice issues on Android Chrome
                    const buffer = await file.arrayBuffer();
                    const data = await exifr.parse(buffer, {
                        tiff: true,
                        ifd0: true,
                        gps: true,
                        exif: true
                    });

                    if (data) {
                        date = data.DateTimeOriginal || data.CreateDate || null;
                        lat = (typeof data.latitude === 'number' && !isNaN(data.latitude)) ? data.latitude : null;
                        lon = (typeof data.longitude === 'number' && !isNaN(data.longitude)) ? data.longitude : null;
                    }
                } catch (err) {
                    console.warn("Pas de métadonnées pour", file.name, err);
                }

                const photoObj = PhotoManager.createPhotoObject(file, date, lat, lon);
                newPhotos.push(photoObj);
            }

            PhotoManager.addPhotos(newPhotos, POIManager.getPois());
            UIManager.renderGallery(PhotoManager.getGroups());

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
