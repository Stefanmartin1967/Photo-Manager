import Sortable from 'sortablejs';
import { createIcons, Info, Trash2, Route } from 'lucide';
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
                Trash2
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

    const albumName = prompt("Nom d'album :", defaultName);
    if (!albumName) return; // User cancelled

    const zip = new JSZip();

    cards.forEach(card => {
        const photoId = card.id;
        const name = card.querySelector('.photo-info').innerText.trim() + ".jpg";

        // Find original file in the flat list
        const photoObj = allPhotosFlat.find(p => p.id === photoId);
        if (photoObj && photoObj.file) {
            zip.file(name, photoObj.file);
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

    // Dynamically adjust grid columns and rows based on number of images
    // Using minmax(0, 1fr) ensures the grid tracks never exceed the viewport size,
    // forcing large images to shrink and fit perfectly.
    const count = selectedImages.length;
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

    selectedImages.forEach(img => {
        const clone = img.cloneNode();
        clone.onclick = null;
        grid.appendChild(clone);
    });
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
