import { calculateHaversineDistance } from './utils.js';
import { DEFAULT_GROUPING_RADIUS } from './constants.js';

let groups = [];
let groupingRadius = DEFAULT_GROUPING_RADIUS;

const generateId = () => Math.random().toString(36).substr(2, 9);

export function getGroupingRadius() {
    return groupingRadius;
}

export function setGroupingRadius(radius) {
    groupingRadius = radius;
}

export function reorganizeAllPhotos(pois) {
    const allPhotos = getAllPhotosFlat();
    // Reset custom names if they were auto-generated?
    // Actually, user might have renamed photos/groups.
    // If we re-cluster, we lose group structure (custom group names).
    // Photo custom names are preserved in the photo object.

    groups = [];
    if (allPhotos.length > 0) {
        addPhotos(allPhotos, pois);
    }
}

export function getGroups() {
    let groupCounter = 1;
    return groups.map(group => {
        const groupNum = String(groupCounter++).padStart(2, '0');
        let baseName = group.customName || (group.type === 'POI' ? group.poi.name : 'Trajet');

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

export function createPhotoObject(file, date, lat, lon) {
     return {
        id: 'id-' + generateId(),
        file: file,
        dataUrl: URL.createObjectURL(file),
        date: date, // Date object or null
        lat: lat,
        lon: lon,
        customName: null
    };
}

export function addPhotos(newPhotoObjects, pois) {
    // 1. Sort new photos by date
    newPhotoObjects.sort((a, b) => (a.date || 0) - (b.date || 0));

    // 2. Cluster into groups
    const newGroups = clusterPhotos(newPhotoObjects, pois);

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

function clusterPhotos(photos, pois) {
    const clusters = [];
    if (photos.length === 0) return clusters;

    let currentGroup = null;

    photos.forEach(photo => {
        const nearest = findNearestPOI(photo.lat, photo.lon, pois);
        const type = nearest ? 'POI' : 'TRAJET';

        let sameGroup = false;
        if (currentGroup && currentGroup.type === type) {
            if (type === 'TRAJET') {
                sameGroup = true;
            } else {
                // Same POI?
                if (currentGroup.poi.name === nearest.name) {
                    sameGroup = true;
                }
            }
        }

        if (sameGroup) {
            currentGroup.photos.push(photo);
        } else {
            currentGroup = {
                id: 'g-' + generateId(),
                type: type,
                poi: nearest, // null if Trajet
                customName: null,
                photos: [photo]
            };
            clusters.push(currentGroup);
        }
    });

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
        if (curr.type === next.type) {
             if (curr.type === 'TRAJET') {
                 if (!curr.customName && !next.customName) canMerge = true;
             } else {
                 if (curr.poi.name === next.poi.name && !curr.customName && !next.customName) {
                     canMerge = true;
                 }
             }
        }

        if (canMerge) {
            curr.photos.push(...next.photos);
            groups.splice(i + 1, 1);
            i--; // Re-check
        }
    }
}

export function movePhoto(photoId, targetGroupId, newIndex) {
    let photo = null;

    for (const g of groups) {
        const idx = g.photos.findIndex(p => p.id === photoId);
        if (idx !== -1) {
            photo = g.photos[idx];
            g.photos.splice(idx, 1);
            // Remove empty group
            if (g.photos.length === 0) {
                const gIdx = groups.indexOf(g);
                groups.splice(gIdx, 1);
            }
            break;
        }
    }

    if (!photo) return;

    const target = groups.find(g => g.id === targetGroupId);
    if (target) {
        target.photos.splice(newIndex, 0, photo);
    }
}

export function extractToTrajet(photoId) {
    let gIndex = -1, pIndex = -1;
    for(let i=0; i<groups.length; i++) {
        const idx = groups[i].photos.findIndex(p => p.id === photoId);
        if(idx !== -1) { gIndex = i; pIndex = idx; break; }
    }
    if (gIndex === -1) return;

    const group = groups[gIndex];
    const photo = group.photos[pIndex];

    group.photos.splice(pIndex, 1);

    const newTrajet = {
        id: 'g-' + generateId(),
        type: 'TRAJET',
        poi: null,
        customName: null,
        photos: [photo]
    };

    if (group.photos.length === 0) {
        groups.splice(gIndex, 1, newTrajet);
    }
    else if (pIndex === group.photos.length) {
        groups.splice(gIndex + 1, 0, newTrajet);
    }
    else if (pIndex === 0) {
        groups.splice(gIndex, 0, newTrajet);
    }
    else {
        // Split
        const remainingPhotos = group.photos.splice(pIndex);
        const newGroupAfter = {
            ...group,
            id: 'g-' + generateId(),
            photos: remainingPhotos
        };
        groups.splice(gIndex + 1, 0, newTrajet, newGroupAfter);
    }
}

export function renameGroup(groupId, newName) {
    const g = groups.find(g => g.id === groupId);
    if (g) g.customName = newName;
}

export function renamePhoto(photoId, newName) {
    for (const g of groups) {
        const p = g.photos.find(ph => ph.id === photoId);
        if (p) {
            p.customName = newName;
            return;
        }
    }
}

export function removePhoto(id) {
    for (let i = 0; i < groups.length; i++) {
        const idx = groups[i].photos.findIndex(p => p.id === id);
        if (idx !== -1) {
             const p = groups[i].photos[idx];
             if (p.dataUrl && !p.dataUrl.startsWith('data:')) {
                 URL.revokeObjectURL(p.dataUrl);
             }
            groups[i].photos.splice(idx, 1);
            if (groups[i].photos.length === 0) {
                groups.splice(i, 1);
            }
            return;
        }
    }
}
