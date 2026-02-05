import Sortable from 'sortablejs';

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
}

function createPhotoCard(photo) {
    const div = document.createElement('div');
    div.className = 'photo-card';
    div.id = photo.id;

    div.innerHTML = `
        <div class="card-controls">
            <button class="extract-btn" title="Extraire vers Trajet">T</button>
            <button class="delete-btn" title="Supprimer">×</button>
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

    // Select
    div.querySelector('img').onclick = () => {
        div.classList.toggle('selected');
    };

    return div;
}

export function getSelectedImages() {
    return document.querySelectorAll('.photo-card.selected img');
}

export function triggerDownload() {
    document.querySelectorAll('.photo-card').forEach(card => {
        const link = document.createElement('a');
        link.href = card.querySelector('img').src;
        const name = card.querySelector('.photo-info').innerText;
        link.download = name + ".jpg";
        link.click();
    });
}

export function showCompareModal(selectedImages) {
    const grid = document.getElementById('compare-grid');
    grid.innerHTML = '';
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
