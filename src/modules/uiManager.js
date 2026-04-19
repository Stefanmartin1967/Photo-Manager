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
        const isTrajet = group.type === 'TRAJET';
        const parts = group.displayName.split(' - ');
        const groupNum = parts[0];
        const baseName = parts.slice(1).join(' - ');

        const groupEl = document.createElement('div');
        groupEl.className = isTrajet ? 'hw-group-section trajet' : 'hw-group-section';
        groupEl.dataset.groupId = group.id;

        // ── Header ──
        const header = document.createElement('div');
        header.className = 'hw-group-header';

        const numBadge = document.createElement('div');
        numBadge.className = isTrajet ? 'hw-group-num trajet' : 'hw-group-num';
        numBadge.innerHTML = isTrajet ? '<i data-lucide="route"></i>' : groupNum;

        const titleWrap = document.createElement('div');
        titleWrap.className = 'hw-group-title-wrap';

        const title = document.createElement('span');
        title.className = 'hw-group-title';
        title.innerText = baseName;
        title.contentEditable = true;
        title.spellcheck = false;

        const meta = document.createElement('div');
        meta.className = 'hw-group-meta';
        meta.textContent = `${group.photos.length} photo${group.photos.length > 1 ? 's' : ''}`;

        const handleRename = () => {
            const cleanName = title.innerText.trim();
            if (cleanName !== group.customName && cleanName !== baseName) {
                globalCallbacks.onRenameGroup(group.id, cleanName);
            }
        };
        title.onfocus = () => selectContent(title);
        title.onblur = handleRename;
        title.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); title.blur(); } };

        titleWrap.appendChild(title);
        titleWrap.appendChild(meta);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'hw-group-actions';

        const saveGroupBtn = document.createElement('button');
        saveGroupBtn.className = 'hw-action-button save-group-btn';
        saveGroupBtn.title = `Enregistrer le groupe : ${group.displayName}`;
        saveGroupBtn.innerHTML = '<i data-lucide="save"></i>';
        saveGroupBtn.onclick = () => {
            const allPhotosFlat = window.__getAllPhotosFlatForExport ? window.__getAllPhotosFlatForExport() : [];
            downloadPhotosAsZip(group.photos, group.customName || baseName, allPhotosFlat);
        };
        actionsDiv.appendChild(saveGroupBtn);

        header.appendChild(numBadge);
        header.appendChild(titleWrap);
        header.appendChild(actionsDiv);
        groupEl.appendChild(header);

        // ── Photo grid ──
        const list = document.createElement('div');
        list.className = 'hw-group-photos';
        list.dataset.groupId = group.id;

        group.photos.forEach(photo => list.appendChild(createPhotoCard(photo)));

        new Sortable(list, {
            group: 'shared-gallery',
            animation: 150,
            ghostClass: 'sortable-ghost',
            delay: 100,
            delayOnTouchOnly: true,
            onEnd: (evt) => {
                if (!evt.to || (evt.from === evt.to && evt.oldIndex === evt.newIndex)) return;
                globalCallbacks.onMove(evt.item.id, evt.to.dataset.groupId, evt.newIndex);
            }
        });

        groupEl.appendChild(list);
        galleryElement.appendChild(groupEl);
    });

    try {
        createIcons({ root: galleryElement, icons: { Info, Route, Trash2, Check, Save } });
    } catch (e) {
        console.error("Lucide createIcons error:", e);
    }
}

function createPhotoCard(photo) {
    const div = document.createElement('div');
    div.className = 'hw-photo-card';
    div.id = photo.id;

    // Image wrap with hover actions
    const imgWrap = document.createElement('div');
    imgWrap.className = 'hw-photo-img-wrap';

    const img = document.createElement('img');
    img.src = photo.dataUrl;
    img.alt = '';

    const actionsOverlay = document.createElement('div');
    actionsOverlay.className = 'hw-photo-actions';
    actionsOverlay.innerHTML = `
        <button class="hw-photo-action-btn info-btn" title="Infos Métadonnées"><i data-lucide="info"></i></button>
        <button class="hw-photo-action-btn extract-btn" title="Extraire vers Trajet"><i data-lucide="route"></i></button>
        <button class="hw-photo-action-btn danger delete-btn" title="Supprimer"><i data-lucide="trash-2"></i></button>
    `;

    const checkmark = document.createElement('div');
    checkmark.className = 'hw-photo-checkmark';
    checkmark.style.display = 'none';
    checkmark.innerHTML = '<i data-lucide="check"></i>';

    img.onclick = () => {
        div.classList.toggle('selected');
        checkmark.style.display = div.classList.contains('selected') ? 'grid' : 'none';
    };

    imgWrap.appendChild(img);
    imgWrap.appendChild(actionsOverlay);
    imgWrap.appendChild(checkmark);

    // Name: button → input swap
    const infoDiv = document.createElement('div');
    infoDiv.className = 'hw-photo-info';

    const nameBtn = document.createElement('button');
    nameBtn.className = 'hw-photo-name';
    nameBtn.textContent = photo.finalName;
    nameBtn.title = photo.finalName;

    nameBtn.onclick = () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'hw-photo-name-input';
        input.value = nameBtn.textContent;
        infoDiv.replaceChild(input, nameBtn);
        input.focus();
        input.select();

        const commit = () => {
            const text = input.value.trim();
            if (text && text !== photo.finalName) {
                globalCallbacks.onRenamePhoto(photo.id, text);
                nameBtn.textContent = text;
                nameBtn.title = text;
            }
            if (input.parentNode === infoDiv) infoDiv.replaceChild(nameBtn, input);
        };
        input.onblur = commit;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            if (e.key === 'Escape') { if (input.parentNode === infoDiv) infoDiv.replaceChild(nameBtn, input); }
        };
    };

    infoDiv.appendChild(nameBtn);
    div.appendChild(imgWrap);
    div.appendChild(infoDiv);

    // Action handlers
    actionsOverlay.querySelector('.delete-btn').onclick = () => globalCallbacks.onDelete(photo.id);
    actionsOverlay.querySelector('.extract-btn').onclick = () => globalCallbacks.onExtract(photo.id);
    actionsOverlay.querySelector('.info-btn').onclick = () => {
        const dateStr = photo.date ? new Date(photo.date).toLocaleString() : 'N/A';
        const latStr = (photo.lat !== null && photo.lat !== undefined) ? photo.lat.toFixed(6) : 'N/A';
        const lonStr = (photo.lon !== null && photo.lon !== undefined) ? photo.lon.toFixed(6) : 'N/A';
        alert(`Date: ${dateStr}\nLat: ${latStr}\nLon: ${lonStr}`);
    };

    return div;
}

export function getSelectedImages() {
    return document.querySelectorAll('.hw-photo-card.selected img');
}

export async function triggerDownload(allPhotosFlat) {
    const cards = document.querySelectorAll('.hw-photo-card');
    if (cards.length === 0) {
        alert("Aucune photo à enregistrer.");
        return;
    }

    let defaultName = "Circuit_Djerba";
    const groupTitles = Array.from(document.querySelectorAll('.hw-group-title')).map(el => el.innerText.trim());
    if (groupTitles.length > 0) {
        const first = groupTitles[0];
        const last = groupTitles[groupTitles.length - 1];
        if (first && last && first !== last) {
            defaultName = `Circuit de ${first} à ${last}`;
        } else if (first) {
            defaultName = `Circuit ${first}`;
        }
    }

    const photosToDownload = Array.from(cards).map((card) => {
        const photoObj = allPhotosFlat.find(p => p.id === card.id);
        const nameBtn = card.querySelector('.hw-photo-name');
        const finalName = nameBtn ? nameBtn.textContent.trim() : null;
        return photoObj ? { ...photoObj, finalName: finalName || photoObj.finalName } : null;
    }).filter(p => p !== null);

    await downloadPhotosAsZip(photosToDownload, defaultName, allPhotosFlat);
}

async function downloadPhotosAsZip(photos, albumNameDefault, allPhotosFlatContext) {
    if (!photos || photos.length === 0) {
        alert("Aucune photo à enregistrer dans ce groupe.");
        return;
    }

    const albumName = prompt("Nom d'album :", albumNameDefault);
    if (!albumName) return;

    const zip = new JSZip();

    photos.forEach((photo, index) => {
        let extension = 'jpg';
        let fileToZip = photo.file;

        if (!fileToZip && allPhotosFlatContext) {
            const contextPhoto = allPhotosFlatContext.find(p => p.id === photo.id);
            if (contextPhoto && contextPhoto.file) fileToZip = contextPhoto.file;
        }

        if (fileToZip && fileToZip.name) {
            const parts = fileToZip.name.split('.');
            if (parts.length > 1) extension = parts.pop();
        }

        const baseName = photo.finalName || photo.customName || `Photo_${String(index + 1).padStart(3, '0')}`;
        if (fileToZip) zip.file(`${baseName}.${extension}`, fileToZip);
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
    let cards = Array.from(selectedImages).map(img => img.closest('.hw-photo-card'));

    const renderGrid = () => {
        grid.innerHTML = '';
        const count = cards.length;
        if (count === 0) { closeCompareModal(); return; }

        if (count === 1) {
            grid.style.gridTemplateColumns = 'minmax(0, 1fr)';
            grid.style.gridTemplateRows = 'minmax(0, 1fr)';
        } else if (count === 2) {
            grid.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
            grid.style.gridTemplateRows = 'minmax(0, 1fr)';
        } else {
            grid.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
            grid.style.gridTemplateRows = 'repeat(2, minmax(0, 1fr))';
        }

        cards.forEach(originalCard => {
            const item = document.createElement('div');
            item.className = 'hw-compare-item';

            const img = document.createElement('img');
            const srcImg = originalCard.querySelector('img');
            img.src = srcImg ? srcImg.src : '';
            img.alt = '';

            const label = document.createElement('div');
            label.className = 'hw-compare-label';

            const nameEl = document.createElement('span');
            const nameBtn = originalCard.querySelector('.hw-photo-name');
            nameEl.textContent = nameBtn ? nameBtn.textContent : '';

            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex;gap:6px;';

            const makeBtn = (icon, title, cls, onClick) => {
                const btn = document.createElement('button');
                btn.className = `hw-photo-action-btn${cls ? ' ' + cls : ''}`;
                btn.title = title;
                btn.innerHTML = `<i data-lucide="${icon}"></i>`;
                btn.onclick = onClick;
                return btn;
            };

            btnRow.appendChild(makeBtn('check', 'Valider', '', () => {
                cards = cards.filter(c => c.id !== originalCard.id);
                const mainCard = document.getElementById(originalCard.id);
                if (mainCard) {
                    mainCard.classList.remove('selected');
                    const ck = mainCard.querySelector('.hw-photo-checkmark');
                    if (ck) ck.style.display = 'none';
                }
                renderGrid();
            }));
            btnRow.appendChild(makeBtn('info', 'Infos', '', () => {
                const btn = originalCard.querySelector('.info-btn');
                if (btn) btn.click();
            }));
            btnRow.appendChild(makeBtn('route', 'Extraire vers Trajet', '', () => {
                globalCallbacks.onExtract(originalCard.id);
                cards = cards.filter(c => c.id !== originalCard.id);
                renderGrid();
            }));
            btnRow.appendChild(makeBtn('trash-2', 'Supprimer', 'danger', () => {
                globalCallbacks.onDelete(originalCard.id);
                cards = cards.filter(c => c.id !== originalCard.id);
                renderGrid();
            }));

            label.appendChild(nameEl);
            label.appendChild(btnRow);
            item.appendChild(img);
            item.appendChild(label);
            grid.appendChild(item);
        });

        try {
            createIcons({ root: grid, icons: { Info, Route, Trash2, Check } });
        } catch (e) {
            console.error("Lucide createIcons error in compare modal:", e);
        }
    };

    renderGrid();
    document.getElementById('compare-modal').style.display = 'flex';
}

export function closeCompareModal() {
    document.getElementById('compare-modal').style.display = 'none';
}

export function updateGroupTitle(groupId, displayName) {
    const groupEl = galleryElement.querySelector(`[data-group-id="${groupId}"]`);
    if (!groupEl) return;
    const parts = displayName.split(' - ');
    const baseName = parts.slice(1).join(' - ');
    const titleEl = groupEl.querySelector('.hw-group-title');
    if (titleEl && document.activeElement !== titleEl) titleEl.innerText = baseName;
    const saveBtn = groupEl.querySelector('.save-group-btn');
    if (saveBtn) saveBtn.title = `Enregistrer le groupe : ${displayName}`;
}

export function updatePhotoName(photoId, finalName) {
    const card = document.getElementById(photoId);
    if (!card) return;
    const btn = card.querySelector('.hw-photo-name');
    if (btn) { btn.textContent = finalName; btn.title = finalName; }
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
