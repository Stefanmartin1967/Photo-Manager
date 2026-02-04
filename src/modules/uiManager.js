import Sortable from 'sortablejs';

let galleryElement = null;

export function initGallery(elementId, callbacks) {
    galleryElement = document.getElementById(elementId);

    new Sortable(galleryElement, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: () => {
             const newOrderIds = Array.from(galleryElement.children).map(child => child.id);
             if (callbacks.onReorder) callbacks.onReorder(newOrderIds);
             updatePhotoNames(callbacks.getPhotos());
        }
    });
}

export function addPhotoCard(photo, callbacks) {
    const div = document.createElement('div');
    div.className = 'photo-card';
    div.id = photo.id;
    div.innerHTML = `
        <button class="delete-btn">×</button>
        <img src="${photo.dataUrl}">
        <div class="photo-info">Calcul...</div>
        <div class="arrows">
            <span class="arrow-btn" data-dir="-1">◀</span>
            <span class="arrow-btn" data-dir="1">▶</span>
        </div>
    `;

    // Delete
    div.querySelector('.delete-btn').onclick = () => {
        div.remove();
        if(callbacks.onDelete) callbacks.onDelete(photo.id);
        updatePhotoNames(callbacks.getPhotos());
    };

    // Selection
    div.querySelector('img').onclick = () => {
        div.classList.toggle('selected');
    };

    // Arrows
    div.querySelectorAll('.arrow-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const dir = parseInt(btn.dataset.dir);
            if (dir === -1 && div.previousElementSibling) {
                div.parentNode.insertBefore(div, div.previousElementSibling);
            }
            if (dir === 1 && div.nextElementSibling) {
                div.parentNode.insertBefore(div.nextElementSibling, div);
            }

            const newOrderIds = Array.from(galleryElement.children).map(child => child.id);
            if (callbacks.onReorder) callbacks.onReorder(newOrderIds);

            updatePhotoNames(callbacks.getPhotos());
        }
    });

    galleryElement.appendChild(div);
}

export function updatePhotoNames(photoList) {
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

export function getSelectedImages() {
    return document.querySelectorAll('.photo-card.selected img');
}

export function triggerDownload() {
    document.querySelectorAll('.photo-card').forEach(card => {
        const link = document.createElement('a');
        link.href = card.querySelector('img').src;
        link.download = card.dataset.downloadName;
        link.click();
    });
}

export function showCompareModal(selectedImages) {
    const grid = document.getElementById('compare-grid');
    grid.innerHTML = '';
    selectedImages.forEach(img => grid.appendChild(img.cloneNode()));
    document.getElementById('compare-modal').style.display = 'block';
}

export function closeCompareModal() {
    document.getElementById('compare-modal').style.display = 'none';
}
