import './style.css'
import exifr from 'exifr'
import { createIcons, ImagePlus, ArrowRightLeft, Save, Share2, Minus, Plus, Trash2 } from 'lucide'
import * as POIManager from './modules/poiManager.js'
import * as PhotoManager from './modules/photoManager.js'
import * as UIManager from './modules/uiManager.js'
import * as ThemeManager from './modules/themeManager.js'
import * as StorageManager from './modules/storageManager.js'

(async () => {
    // 0. Initialisation Lucide Icons
    createIcons({
        icons: {
            ImagePlus,
            ArrowRightLeft,
            Save,
            Share2,
            Minus,
            Plus,
            Trash2
        }
    });

    let saveTimeout = null;
    const debouncedSave = () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            StorageManager.saveState({
                groups: PhotoManager.getRawGroups(),
                groupingRadius: PhotoManager.getGroupingRadius()
            });
        }, 1000);
    };

    const updateStateAndUI = () => {
        UIManager.renderGallery(PhotoManager.getGroups());
        debouncedSave();
    };

    // 1. Initialisation Thème
    ThemeManager.init();

    // 2. Chargement des POIs
    await POIManager.loadPOIs();

    // 3. Initialisation UI et Restauration
    UIManager.initGallery('default-gallery', {
        onMove: (photoId, targetGroupId, newIndex) => {
            PhotoManager.pushUndoSnapshot();
            PhotoManager.movePhoto(photoId, targetGroupId, newIndex);
            updateStateAndUI();
        },
        onRenameGroup: (groupId, newName) => {
            PhotoManager.pushUndoSnapshot();
            PhotoManager.renameGroup(groupId, newName);
            const group = PhotoManager.getGroups().find(g => g.id === groupId);
            if (group) UIManager.updateGroupTitle(groupId, group.displayName);
            debouncedSave();
        },
        onRenamePhoto: (photoId, newName) => {
            PhotoManager.pushUndoSnapshot();
            PhotoManager.renamePhoto(photoId, newName);
            debouncedSave();
        },
        onExtract: (photoId) => {
            PhotoManager.pushUndoSnapshot();
            PhotoManager.extractToTrajet(photoId);
            updateStateAndUI();
        },
        onDelete: (photoId) => {
            PhotoManager.pushUndoSnapshot();
            PhotoManager.removePhoto(photoId);
            updateStateAndUI();
        }
    });

    // 4. Radius Control Logic
    const radiusInput = document.getElementById('radiusInput');
    const radiusMinus = document.getElementById('radiusMinus');
    const radiusPlus = document.getElementById('radiusPlus');

    const updateRadius = async (newVal) => {
        const val = parseInt(newVal);
        if (isNaN(val) || val < 0) return;

        PhotoManager.pushUndoSnapshot();
        PhotoManager.setGroupingRadius(val);
        radiusInput.value = val;

        await PhotoManager.reorganizeAllPhotos(POIManager.getPois());
        updateStateAndUI();
    };

    if (radiusInput && radiusMinus && radiusPlus) {
        // Init default
        radiusInput.value = PhotoManager.getGroupingRadius();

        radiusMinus.onclick = async () => {
            const current = parseInt(radiusInput.value) || 0;
            await updateRadius(Math.max(0, current - 50));
        };

        radiusPlus.onclick = async () => {
            const current = parseInt(radiusInput.value) || 0;
            await updateRadius(current + 50);
        };

        radiusInput.onchange = async () => {
            await updateRadius(radiusInput.value);
        };
    }

    // 5. Gestion des photos (Input)
    const photoInput = document.getElementById('photoInput');
    const addPhotoBtn = document.getElementById('addPhotoBtn');
    const heicProgressEl = document.getElementById('heic-progress');

    const isHeic = (filename) => /\.(heic|heif)$/i.test(filename);

    // Lazy worker — créé uniquement si des fichiers HEIC sont importés
    let heicWorker = null;
    let workerMsgId = 0;
    const workerCallbacks = new Map();

    const getHeicWorker = () => {
        if (!heicWorker) {
            heicWorker = new Worker(new URL('./workers/heicWorker.js', import.meta.url), { type: 'module' });
            heicWorker.onmessage = ({ data: { id, blob, error } }) => {
                const resolve = workerCallbacks.get(id);
                if (resolve) {
                    workerCallbacks.delete(id);
                    resolve(error ? null : blob);
                }
            };
        }
        return heicWorker;
    };

    const convertHeicViaWorker = (file) => new Promise((resolve) => {
        const id = ++workerMsgId;
        workerCallbacks.set(id, resolve);
        getHeicWorker().postMessage({ id, blob: file });
    });

    if (addPhotoBtn && photoInput) {
        addPhotoBtn.onclick = () => photoInput.click();
    }

    if (photoInput) {
        photoInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            const newPhotos = [];

            const heicFiles = files.filter(f => isHeic(f.name));
            let heicDone = 0;

            if (heicFiles.length > 0) {
                heicProgressEl.textContent = `HEIC 0/${heicFiles.length}`;
                heicProgressEl.style.display = 'inline';
            }

            for (const file of files) {
                let date = null;
                let lat = null;
                let lon = null;
                let displayBlob = null;

                try {
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

                if (!date) date = new Date(file.lastModified);

                if (isHeic(file.name)) {
                    displayBlob = await convertHeicViaWorker(file);
                    if (!displayBlob) {
                        console.warn("Échec conversion HEIC pour", file.name);
                        heicDone++;
                        heicProgressEl.textContent = `HEIC ${heicDone}/${heicFiles.length}`;
                        continue;
                    }
                    heicDone++;
                    heicProgressEl.textContent = `HEIC ${heicDone}/${heicFiles.length}`;
                }

                const photoObj = PhotoManager.createPhotoObject(file, date, lat, lon, displayBlob);
                newPhotos.push(photoObj);
            }

            heicProgressEl.style.display = 'none';

            PhotoManager.pushUndoSnapshot();
            await PhotoManager.addPhotos(newPhotos, POIManager.getPois());
            updateStateAndUI();

            e.target.value = ''; // Reset input
        });
    }

    // Load initial state
    const savedState = await StorageManager.loadState();
    if (savedState) {
        if (PhotoManager.restoreState(savedState)) {
            if (radiusInput) radiusInput.value = PhotoManager.getGroupingRadius();
            UIManager.renderGallery(PhotoManager.getGroups());
        }
    }

    // Expose allPhotosFlat to window for uiManager's group-level zip exports
    window.__getAllPhotosFlatForExport = PhotoManager.getAllPhotosFlat;

    // Actions des boutons
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.onclick = () => {
            const allPhotos = PhotoManager.getAllPhotosFlat();
            UIManager.triggerDownload(allPhotos);
        };
    }

    const compareBtn = document.getElementById('compareBtn');
    if (compareBtn) {
        compareBtn.onclick = () => {
            const selected = UIManager.getSelectedImages();
            if (selected.length < 1 || selected.length > 4) return alert("Sélectionne entre 1 et 4 photos pour comparer");
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
                const card = img.closest('.hw-photo-card');
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

    // Clear Button Logic
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
        clearBtn.onclick = async () => {
            if (confirm("Voulez-vous vraiment effacer le projet en cours ? Cette action supprimera toutes les photos et groupes sauvegardés dans votre navigateur.")) {
                PhotoManager.clearAll();
                await StorageManager.clearState();
                UIManager.renderGallery([]);
                if (radiusInput) radiusInput.value = PhotoManager.getGroupingRadius();
            }
        };
    }

    // Undo / Redo (Ctrl+Z / Ctrl+Y ou Ctrl+Shift+Z)
    document.addEventListener('keydown', async (e) => {
        // Ne pas interférer avec l'undo natif du navigateur dans les champs éditables
        if (document.activeElement && document.activeElement.contentEditable === 'true') return;

        const ctrl = e.ctrlKey || e.metaKey;
        if (!ctrl) return;

        const isUndo = !e.shiftKey && e.key === 'z';
        const isRedo = e.key === 'y' || (e.shiftKey && e.key === 'z');

        if (isUndo) {
            e.preventDefault();
            if (PhotoManager.undo()) {
                if (radiusInput) radiusInput.value = PhotoManager.getGroupingRadius();
                updateStateAndUI();
            }
        } else if (isRedo) {
            e.preventDefault();
            if (PhotoManager.redo()) {
                if (radiusInput) radiusInput.value = PhotoManager.getGroupingRadius();
                updateStateAndUI();
            }
        }
    });

})();
