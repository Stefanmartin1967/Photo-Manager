import { calculateHaversineDistance } from './utils.js';
import { DEFAULT_GROUPING_RADIUS } from './constants.js';

let groups = [];
const photoIdToGroup = new Map();
let groupingRadius = DEFAULT_GROUPING_RADIUS;

const undoStack = [];
const redoStack = [];
const MAX_HISTORY = 20;

const generateId = () => Math.random().toString(36).substr(2, 9);

function takeSnapshot() {
    return {
        groupingRadius,
        groups: groups.map(g => ({ ...g, photos: [...g.photos] }))
    };
}

function applySnapshot(snapshot) {
    groupingRadius = snapshot.groupingRadius;
    groups = snapshot.groups;
    photoIdToGroup.clear();
    groups.forEach(g => g.photos.forEach(p => photoIdToGroup.set(p.id, g)));
}

export function pushUndoSnapshot() {
    redoStack.length = 0;
    undoStack.push(takeSnapshot());
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
}

export function undo() {
    if (undoStack.length === 0) return false;
    redoStack.push(takeSnapshot());
    applySnapshot(undoStack.pop());
    return true;
}

export function redo() {
    if (redoStack.length === 0) return false;
    undoStack.push(takeSnapshot());
    applySnapshot(redoStack.pop());
    return true;
}

export function getGroupingRadius() {
    return groupingRadius;
}

export function setGroupingRadius(radius) {
    groupingRadius = radius;
}

export async function reorganizeAllPhotos(pois) {
    const allPhotos = getAllPhotosFlat();
    // Reset custom names if they were auto-generated?
    // Actually, user might have renamed photos/groups.
    // If we re-cluster, we lose group structure (custom group names).
    // Photo custom names are preserved in the photo object.

    groups = [];
    photoIdToGroup.clear();
    if (allPhotos.length > 0) {
        await addPhotos(allPhotos, pois);
    }
}

export function getGroups() {
    let groupCounter = 1;
    return groups.map(group => {
        const groupNum = String(groupCounter++).padStart(2, '0');
        let baseName = group.customName;
        if (!baseName) {
            baseName = group.type === 'POI' ? group.poi.name : 'Trajet';
        }

        const photosWithNames = group.photos.map((photo, index) => {
            const photoNum = String(index + 1).padStart(2, '0');
            const generatedName = `${groupNum} - ${baseName} - ${photoNum}`;
            return {
                ...photo,
                finalName: photo.customName || generatedName
            };
        });

        return {
            ...group,
            displayName: `${groupNum} - ${baseName}`,
            photos: photosWithNames
        };
    });
}

export function getAllPhotosFlat() {
    return groups.flatMap(g => g.photos);
}

export function createPhotoObject(file, date, lat, lon, displayBlob = null) {
     return {
        id: 'id-' + generateId(),
        file: file,
        displayBlob: displayBlob, // Save reference to recreate object URL later
        dataUrl: URL.createObjectURL(displayBlob || file),
        date: date, // Date object or null
        lat: lat,
        lon: lon,
        customName: null
    };
}

export function getRawGroups() {
    return groups;
}

export function restoreState(savedState) {
    if (!savedState || !savedState.groups) return false;

    // Cleanup old object URLs if any exist in the current session
    groups.forEach(g => {
        g.photos.forEach(p => {
            if (p.dataUrl && !p.dataUrl.startsWith('data:')) {
                URL.revokeObjectURL(p.dataUrl);
            }
        });
    });

    setGroupingRadius(savedState.groupingRadius || DEFAULT_GROUPING_RADIUS);

    groups = savedState.groups;
    photoIdToGroup.clear();

    // Rebuild data URLs and lookup map
    groups.forEach(g => {
        g.photos.forEach(photo => {
            photoIdToGroup.set(photo.id, g);
            // Re-create temporary URLs from the restored blobs
            photo.dataUrl = URL.createObjectURL(photo.displayBlob || photo.file);
        });
    });

    return true;
}

export function clearAll() {
    groups.forEach(g => {
        g.photos.forEach(p => {
            if (p.dataUrl && !p.dataUrl.startsWith('data:')) {
                URL.revokeObjectURL(p.dataUrl);
            }
        });
    });
    groups = [];
    photoIdToGroup.clear();
    setGroupingRadius(DEFAULT_GROUPING_RADIUS);
    undoStack.length = 0;
    redoStack.length = 0;
}

export async function addPhotos(newPhotoObjects, pois) {
    // 1. Sort new photos by date
    newPhotoObjects.sort((a, b) => (a.date || 0) - (b.date || 0));

    // 2. Cluster into groups
    const newGroups = await clusterPhotos(newPhotoObjects, pois);

    // 3. Merge into existing groups
    groups.push(...newGroups);
    groups.sort((a, b) => {
        const dateA = a.photos[0]?.date || 0;
        const dateB = b.photos[0]?.date || 0;
        return dateA - dateB;
    });

    // 4. Merge adjacent groups
    mergeAdjacentGroups();
}

async function clusterPhotos(photos, pois) {
    const clusters = [];
    if (photos.length === 0) return clusters;

    let currentGroup = null;

    for (const photo of photos) {
        const nearest = findNearestPOI(photo.lat, photo.lon, pois);
        const type = nearest ? 'POI' : 'TRAJET';

        let sameGroup = false;
        if (currentGroup && currentGroup.type === type) {
            if (type === 'TRAJET') {
                const lastPhoto = currentGroup.photos[currentGroup.photos.length - 1];
                if (lastPhoto && lastPhoto.lat != null && lastPhoto.lon != null && photo.lat != null && photo.lon != null) {
                    const dist = calculateHaversineDistance(lastPhoto.lat, lastPhoto.lon, photo.lat, photo.lon);
                    if (isNaN(dist) || dist <= groupingRadius) {
                        sameGroup = true;
                    }
                } else {
                    sameGroup = true;
                }
            } else if (currentGroup.poi.name === nearest.name) {
                sameGroup = true;
            }
        }

        if (sameGroup) {
            currentGroup.photos.push(photo);
        } else {
            currentGroup = {
                id: 'g-' + generateId(),
                type: type,
                poi: nearest,
                customName: null,
                photos: [photo]
            };
            clusters.push(currentGroup);
        }
        photoIdToGroup.set(photo.id, currentGroup);
    }

    return clusters;
}

function findNearestPOI(lat, lon, pois) {
    if (!lat || !lon) return null;
    let nearest = null;
    let minDist = Infinity;

    pois.forEach(p => {
        const d = calculateHaversineDistance(lat, lon, p.lat, p.lon);
        if (d < minDist) {
            minDist = d;
            nearest = p;
        }
    });

    // Rayon dynamique
    if (minDist <= groupingRadius) {
        return nearest;
    }
    return null;
}

function mergeAdjacentGroups() {
    for (let i = 0; i < groups.length - 1; i++) {
        const curr = groups[i];
        const next = groups[i+1];

        let canMerge = false;
        if (curr.type === next.type && !curr.customName && !next.customName) {
             if (curr.type === 'TRAJET') {
                 const lastPhoto = curr.photos[curr.photos.length - 1];
                 const firstPhotoNext = next.photos[0];

                 if (lastPhoto && firstPhotoNext && lastPhoto.lat != null && lastPhoto.lon != null && firstPhotoNext.lat != null && firstPhotoNext.lon != null) {
                     const dist = calculateHaversineDistance(lastPhoto.lat, lastPhoto.lon, firstPhotoNext.lat, firstPhotoNext.lon);
                     if (isNaN(dist) || dist <= groupingRadius) {
                         canMerge = true;
                     }
                 } else {
                     canMerge = true;
                 }
             } else if (curr.poi.name === next.poi.name) {
                 canMerge = true;
             }
        }

        if (canMerge) {
            next.photos.forEach(p => photoIdToGroup.set(p.id, curr));
            curr.photos.push(...next.photos);
            groups.splice(i + 1, 1);
            i--; // Re-check
        }
    }
}

export function movePhoto(photoId, targetGroupId, newIndex) {
    const g = photoIdToGroup.get(photoId);
    if (!g) return;

    const idx = g.photos.findIndex(p => p.id === photoId);
    if (idx === -1) return;
    const photo = g.photos[idx];
    g.photos.splice(idx, 1);

    // Remove empty group
    if (g.photos.length === 0) {
        const gIdx = groups.indexOf(g);
        if (gIdx !== -1) groups.splice(gIdx, 1);
    }

    const target = groups.find(t => t.id === targetGroupId);
    if (target) {
        target.photos.splice(newIndex, 0, photo);
        photoIdToGroup.set(photoId, target);
    } else {
        photoIdToGroup.delete(photoId);
    }
}

export function extractToTrajet(photoId) {
    const group = photoIdToGroup.get(photoId);
    if (!group) return;

    const pIndex = group.photos.findIndex(p => p.id === photoId);
    if (pIndex === -1) return;
    const gIndex = groups.indexOf(group);
    if (gIndex === -1) return;

    const photo = group.photos[pIndex];
    group.photos.splice(pIndex, 1);

    const newTrajet = {
        id: 'g-' + generateId(),
        type: 'TRAJET',
        poi: null,
        customName: null,
        photos: [photo]
    };
    photoIdToGroup.set(photo.id, newTrajet);

    if (group.photos.length === 0) {
        groups.splice(gIndex, 1, newTrajet);
    } else {
        // Insert the new Trajet group right before the original group
        // which prevents the original group from being split in two.
        groups.splice(gIndex, 0, newTrajet);
    }
}

export function renameGroup(groupId, newName) {
    const g = groups.find(g => g.id === groupId);
    if (g) {
        // If the new name is empty or null, we revert to default by setting customName to null
        g.customName = (newName && typeof newName === 'string' && newName.trim() !== '') ? newName : null;
    }
}

export function renamePhoto(photoId, newName) {
    const g = photoIdToGroup.get(photoId);
    if (g) {
        const p = g.photos.find(ph => ph.id === photoId);
        if (p) p.customName = newName;
    }
}

export function removePhoto(id) {
    const g = photoIdToGroup.get(id);
    if (!g) return;

    const idx = g.photos.findIndex(p => p.id === id);
    if (idx !== -1) {
        const p = g.photos[idx];
        if (p.dataUrl && !p.dataUrl.startsWith('data:')) {
            URL.revokeObjectURL(p.dataUrl);
        }
        g.photos.splice(idx, 1);
        photoIdToGroup.delete(id);
        if (g.photos.length === 0) {
            const gIdx = groups.indexOf(g);
            if (gIdx !== -1) groups.splice(gIdx, 1);
        }
    }
}
