let photoList = [];

export function getPhotos() {
    return photoList;
}

export function addPhoto(photoObj) {
    photoList.push(photoObj);
}

export function removePhoto(id) {
    const index = photoList.findIndex(p => p.id === id);
    if (index !== -1) {
        // Revoke the object URL to free memory if it was created with createObjectURL
        if (photoList[index].dataUrl && !photoList[index].dataUrl.startsWith('data:')) {
             URL.revokeObjectURL(photoList[index].dataUrl);
        }
        photoList.splice(index, 1);
    }
}

export function reorderPhotos(newOrderIds) {
    const newPhotoList = [];
    newOrderIds.forEach(id => {
        const photo = photoList.find(p => p.id === id);
        if (photo) {
            newPhotoList.push(photo);
        }
    });
    // Only update if we have a valid reorder (sanity check)
    if (newPhotoList.length === photoList.length) {
         photoList.length = 0;
         photoList.push(...newPhotoList);
    } else {
        console.warn("Reorder failed: ID mismatch or missing photos.");
    }
}

export function createPhotoObject(file, poiName) {
     const objectUrl = URL.createObjectURL(file);
     return {
        id: 'id-' + Math.random().toString(36).substr(2, 9),
        file: file,
        dataUrl: objectUrl,
        poiName: poiName || "Inconnu"
    };
}
