import Sortable from 'sortablejs';
import { createIcons, Info, Trash2, Route, Check, Save } from 'lucide';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

let galleryElement = null;
let globalCallbacks = {};

export function initGallery(elementId, callbacks) {
    galleryElement = document.getElementById(elementId);
    globalCallbacks = callbacks;
}

export function renderGallery(groups) {
    galleryElement.innerHTML = '';

    groups.forEach(group => {
        const groupEl = document.createElement('div');
        groupEl.className = 'group-section';
        groupEl.dataset.groupId = group.id;

        // Header
        const header = document.createElement('div');
        header.className = 'group-header';

        const title = document.createElement('span');
        title.className = 'group-title';
        title.innerText = group.displayName;
        title.contentEditable = true;
        title.spellcheck = false;

        const handleRename = () => {
             let text = title.innerText.trim();
             const match = text.match(/^\d+\s*-\s*(.*)/);
             const cleanName = match ? match[1] : text;

             if (cleanName !== group.customName && cleanName !== group.displayName) {
                 globalCallbacks.onRenameGroup(group.id, cleanName);
             }
        };

        title.onfocus = () => selectContent(title);
        title.onblur = handleRename;
        title.onkeydown = (e) => {
            if(e.key === 'Enter') {
                e.preventDefault();
                title.blur();
            }
        };

        header.appendChild(title);

        // Group Save Button
        const saveGroupBtn = document.createElement('button');
        saveGroupBtn.className = 'save-group-btn';
        saveGroupBtn.title = `Enregistrer le groupe : ${group.displayName}`;
        saveGroupBtn.innerHTML = '<i data-lucide="save"></i>';
        saveGroupBtn.onclick = () => {
            const allPhotosFlat = window.__getAllPhotosFlatForExport ? window.__getAllPhotosFlatForExport() : [];
            // Retrieve only photos of this group
            downloadPhotosAsZip(group.photos, group.customName || group.displayName, allPhotosFlat);
        };

        header.appendChild(saveGroupBtn);

        groupEl.appendChild(header);

        // List
        const list = document.createElement('div');
        list.className = 'group-photos';
        list.dataset.groupId = group.id;

        group.photos.forEach(photo => {
            const card = createPhotoCard(photo);
            list.appendChild(card);
        });

        // Sortable
        new Sortable(list, {
            group: 'shared-gallery',
            animation: 150,
            ghostClass: 'sortable-ghost',
            delay: 100,
            delayOnTouchOnly: true,
            onEnd: (evt) => {
                if (!evt.to || (evt.from === evt.to && evt.oldIndex === evt.newIndex)) return;

                const photoId = evt.item.id;
                const targetGroupId = evt.to.dataset.groupId;
                const newIndex = evt.newIndex;

                globalCallbacks.onMove(photoId, targetGroupId, newIndex);
            }
        });

        groupEl.appendChild(list);
        galleryElement.appendChild(groupEl);
    });

    // Initialize icons for the entire gallery
    try {
        createIcons({
            root: galleryElement,
            icons: {
                Info,
                Route,
                Trash2,
                Check,
                Save
            }
        });
    } catch (e) {
        console.error("Lucide createIcons error:", e);
    }
}

function createPhotoCard(photo) {
    const div = document.createElement('div');
    div.className = 'photo-card';
    div.id = photo.id;

    div.innerHTML = `
        <div class="card-controls">
            <button class="info-btn" title="Infos Métadonnées"><i data-lucide="info"></i></button>
            <button class="extract-btn" title="Extraire vers Trajet"><i data-lucide="route"></i></button>
            <button class="delete-btn" title="Supprimer"><i data-lucide="trash-2"></i></button>
        </div>
        <img src="${photo.dataUrl}">
        <div class="photo-info" contenteditable="true" spellcheck="false">${photo.finalName}</div>
    `;

    // Rename Photo
    const info = div.querySelector('.photo-info');
    const handlePhotoRename = () => {
         const text = info.innerText.trim();
         if (text !== photo.finalName) {
            globalCallbacks.onRenamePhoto(photo.id, text);
         }
    };
    info.onfocus = () => selectContent(info);
    info.onblur = handlePhotoRename;
    info.onkeydown = (e) => {
        if(e.key === 'Enter') {
            e.preventDefault();
            info.blur();
        }
    };

    // Actions
    div.querySelector('.delete-btn').onclick = () => globalCallbacks.onDelete(photo.id);
    div.querySelector('.extract-btn').onclick = () => globalCallbacks.onExtract(photo.id);
    div.querySelector('.info-btn').onclick = () => {
        const dateStr = photo.date ? new Date(photo.date).toLocaleString() : 'N/A';
        const latStr = (photo.lat !== null && photo.lat !== undefined) ? photo.lat.toFixed(6) : 'N/A';
        const lonStr = (photo.lon !== null && photo.lon !== undefined) ? photo.lon.toFixed(6) : 'N/A';
        alert(`Date: ${dateStr}\nLat: ${latStr}\nLon: ${lonStr}`);
    };

    // Select
    div.querySelector('img').onclick = () => {
        div.classList.toggle('selected');
    };

    return div;
}

export function getSelectedImages() {
    // Actually, returning the `.photo-card` itself is more useful now.
    // Let's keep returning images for compatibility with main.js, or adjust main.js.
    // Wait, the requirement says "return the image", but main.js uses `.closest('.photo-card')`.
    // Let's just return the `img` elements to avoid breaking `main.js` which expects them.
    return document.querySelectorAll('.photo-card.selected img');
}

export async function triggerDownload(allPhotosFlat) {
    const cards = document.querySelectorAll('.photo-card');
    if (cards.length === 0) {
        alert("Aucune photo à enregistrer.");
        return;
    }

    // Determine default name
    let defaultName = "Circuit_Djerba";
    const groupTitles = Array.from(document.querySelectorAll('.group-title')).map(el => el.innerText.trim());
    if (groupTitles.length > 0) {
        // Extract names without the number prefix if possible
        const cleanName = (title) => {
            const match = title.match(/^\d+\s*-\s*(.*)/);
            return match ? match[1] : title;
        };
        const first = cleanName(groupTitles[0]);
        const last = cleanName(groupTitles[groupTitles.length - 1]);
        if (first && last && first !== last) {
            defaultName = `Circuit de ${first} à ${last}`;
        } else if (first) {
            defaultName = `Circuit ${first}`;
        }
    }

    // Pass the default name to download function to avoid prompting twice
    // Collect photo objects directly from allPhotosFlat based on the visible cards
    const photosToDownload = Array.from(cards).map((card, index) => {
        const photoId = card.id;
        const photoObj = allPhotosFlat.find(p => p.id === photoId);
        return photoObj ? { ...photoObj, finalName: card.querySelector('.photo-info').innerText.trim() } : null;
    }).filter(p => p !== null);

    await downloadPhotosAsZip(photosToDownload, defaultName, allPhotosFlat);
}

// Utility to download a specific array of photo objects as a ZIP
async function downloadPhotosAsZip(photos, albumNameDefault, allPhotosFlatContext) {
    if (!photos || photos.length === 0) {
        alert("Aucune photo à enregistrer dans ce groupe.");
        return;
    }

    // Allow user to confirm or change the album name
    const albumName = prompt("Nom d'album :", albumNameDefault);
    if (!albumName) return;

    const zip = new JSZip();

    photos.forEach((photo, index) => {
        // Find the file extension from the original file (to preserve .heic, .png, etc.)
        // If file doesn't exist, fallback to .jpg
        let extension = 'jpg';
        let fileToZip = photo.file;

        if (!fileToZip && allPhotosFlatContext) {
             const contextPhoto = allPhotosFlatContext.find(p => p.id === photo.id);
             if (contextPhoto && contextPhoto.file) fileToZip = contextPhoto.file;
        }

        if (fileToZip && fileToZip.name) {
             const parts = fileToZip.name.split('.');
             if (parts.length > 1) {
                 extension = parts.pop();
             }
        }

        // Generate a valid final name. If photo.finalName is missing, use a sequential fallback so files don't overwrite each other
        const baseName = photo.finalName || photo.customName || `Photo_${String(index + 1).padStart(3, '0')}`;
        const name = `${baseName}.${extension}`;

        if (fileToZip) {
            zip.file(name, fileToZip);
        }
    });

    try {
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `${albumName}.zip`);
    } catch (err) {
        console.error("Erreur lors de la création du ZIP:", err);
        alert("Une erreur est survenue lors de l'enregistrement des photos.");
    }
}

export function showCompareModal(selectedImages) {
    const grid = document.getElementById('compare-grid');
    grid.innerHTML = '';

    // Convert NodeList/Array of imgs to an array of parent cards to handle them easier
    let cards = Array.from(selectedImages).map(img => img.closest('.photo-card'));

    const renderGrid = () => {
        grid.innerHTML = '';
        const count = cards.length;
        if (count === 0) {
            closeCompareModal();
            return;
        }

        if (count === 1) {
            grid.style.gridTemplateColumns = 'minmax(0, 1fr)';
            grid.style.gridTemplateRows = 'minmax(0, 1fr)';
        } else if (count === 2) {
            grid.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
            grid.style.gridTemplateRows = 'minmax(0, 1fr)';
        } else { // 3 or 4
            grid.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
            grid.style.gridTemplateRows = 'repeat(2, minmax(0, 1fr))';
        }

        cards.forEach(originalCard => {
            const clone = originalCard.cloneNode(true);
            clone.classList.remove('selected'); // Remove selection border in compare mode

            // Remove the selection toggle click from the image
            const img = clone.querySelector('img');
            if (img) img.onclick = null;

            // Prevent editing the name inside compare modal to avoid sync issues
            const info = clone.querySelector('.photo-info');
            if (info) {
                info.contentEditable = false;
                info.onfocus = null;
                info.onblur = null;
                info.onkeydown = null;
            }

            // Mode comparaison: Add Validate Button ("V")
            const cardControls = clone.querySelector('.card-controls');
            if (cardControls) {
                const validateBtn = document.createElement('button');
                validateBtn.className = 'validate-btn';
                validateBtn.title = 'Valider (retirer de la comparaison)';
                validateBtn.innerHTML = '<i data-lucide="check"></i>';

                // Style overrides for comparison mode validate button
                validateBtn.style.color = 'var(--brand)';

                validateBtn.onclick = () => {
                    // Remove from our local cards array
                    cards = cards.filter(c => c.id !== originalCard.id);

                    // Deselect in main gallery
                    const mainGalleryCard = document.getElementById(originalCard.id);
                    if (mainGalleryCard) {
                        mainGalleryCard.classList.remove('selected');
                    }

                    // Re-render the grid
                    renderGrid();
                };

                // Insert as the first button
                cardControls.insertBefore(validateBtn, cardControls.firstChild);
            }

            // Re-attach actions
            const deleteBtn = clone.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.onclick = () => {
                    globalCallbacks.onDelete(originalCard.id);
                    // Remove from our local cards array
                    cards = cards.filter(c => c.id !== originalCard.id);
                    // Re-render the grid
                    renderGrid();
                };
            }

            const extractBtn = clone.querySelector('.extract-btn');
            if (extractBtn) {
                extractBtn.onclick = () => {
                    globalCallbacks.onExtract(originalCard.id);
                    cards = cards.filter(c => c.id !== originalCard.id);
                    renderGrid();
                };
            }

            const infoBtn = clone.querySelector('.info-btn');
            if (infoBtn) {
                // Copy the click handler from the original card's info button
                // Because we don't have the photo object here, we can trigger the original button's click
                infoBtn.onclick = () => {
                    const originalBtn = originalCard.querySelector('.info-btn');
                    if (originalBtn) originalBtn.click();
                };
            }

            grid.appendChild(clone);
        });

        // Initialize icons for the cloned cards
        try {
            createIcons({
                root: grid,
                icons: {
                    Info,
                    Route,
                    Trash2,
                    Check
                }
            });
        } catch (e) {
            console.error("Lucide createIcons error in compare modal:", e);
        }
    };

    renderGrid();
    document.getElementById('compare-modal').style.display = 'block';
}

export function closeCompareModal() {
    document.getElementById('compare-modal').style.display = 'none';
}

function selectContent(element) {
    setTimeout(() => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }, 0);
}
