import { test, describe, before } from 'node:test';
import assert from 'node:assert';

// Force mock URL.createObjectURL and URL.revokeObjectURL
// Even if they exist in Node.js, we want to control them for testing
// and avoid the requirement for Blob objects
global.URL.createObjectURL = () => 'blob:mock-url';
global.URL.revokeObjectURL = () => {};

// Import after mocking
import {
    renameGroup,
    addPhotos,
    getGroups,
    reorganizeAllPhotos,
    createPhotoObject
} from './photoManager.js';

describe('PhotoManager - renameGroup', () => {

    // Reset state before tests
    before(() => {
        reorganizeAllPhotos([]);
    });

    test('should rename an existing group correctly', () => {
        // Setup: Create a photo and add it to create a group
        const mockFile = { name: 'test.jpg', size: 1024 };
        const photo = createPhotoObject(mockFile, new Date(), 48.8566, 2.3522);

        // Add photo with empty POIs to create a TRAJET group
        addPhotos([photo], []);

        // Get the created group
        const initialGroups = getGroups();
        assert.strictEqual(initialGroups.length, 1, 'Should have 1 group');
        const group = initialGroups[0];
        const groupId = group.id;

        // Action: Rename the group
        const newName = 'My Vacation';
        renameGroup(groupId, newName);

        // Verify
        const updatedGroups = getGroups();
        const updatedGroup = updatedGroups[0];

        // Verify customName is updated (internal property reflected in logic)
        // Verify displayName contains the new name
        assert.ok(updatedGroup.displayName.includes(newName), `Display name "${updatedGroup.displayName}" should include "${newName}"`);

        // Clean up
        reorganizeAllPhotos([]);
    });

    test('should revert to default name when renamed to null or empty', () => {
        // Setup: Create a photo and add it to create a group
        const mockFile = { name: 'test3.jpg', size: 1024 };
        const photo = createPhotoObject(mockFile, new Date(), 48.8566, 2.3522);
        addPhotos([photo], []);

        const initialGroups = getGroups();
        const groupId = initialGroups[0].id;

        // 1. Rename to custom
        renameGroup(groupId, 'Custom Name');
        assert.ok(getGroups()[0].displayName.includes('Custom Name'));

        // 2. Rename to null (revert)
        renameGroup(groupId, null);
        const revertedGroup = getGroups()[0];
        assert.ok(revertedGroup.displayName.includes('Trajet'), 'Should revert to default name "Trajet"');

        // Clean up
        reorganizeAllPhotos([]);
    });

    test('should do nothing when renaming a non-existent group', () => {
        // Setup: Create a photo and add it to create a group
        const mockFile = { name: 'test2.jpg', size: 1024 };
        const photo = createPhotoObject(mockFile, new Date(), 48.8566, 2.3522);
        addPhotos([photo], []);

        const initialGroups = getGroups();
        const initialName = initialGroups[0].displayName;

        // Action: Rename a non-existent group
        renameGroup('non-existent-id', 'New Name');

        // Verify
        const updatedGroups = getGroups();
        assert.strictEqual(updatedGroups[0].displayName, initialName, 'Group name should not change');

        // Clean up
        reorganizeAllPhotos([]);
    });
});
