import { test, describe } from 'node:test';
import assert from 'node:assert';
import { calculateHaversineDistance } from './utils.js';

describe('calculateHaversineDistance', () => {
    test('should return 0 for identical coordinates', () => {
        const lat = 48.8566;
        const lon = 2.3522;
        const result = calculateHaversineDistance(lat, lon, lat, lon);
        assert.strictEqual(result, 0);
    });

    test('should return approximately 344km for Paris to London', () => {
        const paris = { lat: 48.8566, lon: 2.3522 };
        const london = { lat: 51.5074, lon: -0.1278 };
        const result = calculateHaversineDistance(paris.lat, paris.lon, london.lat, london.lon);

        // Expected distance is about 344,000 meters
        const expected = 344000;
        const tolerance = 1000; // 1km tolerance

        assert.ok(Math.abs(result - expected) < tolerance, `Distance ${result} is not within tolerance of ${expected}`);
    });

    test('should return approximately 111.19km for 1 degree on the equator', () => {
        const lat = 0;
        const lon1 = 0;
        const lon2 = 1;
        const result = calculateHaversineDistance(lat, lon1, lat, lon2);

        const expected = 111194.9;
        const tolerance = 10;

        assert.ok(Math.abs(result - expected) < tolerance, `Distance ${result} is not within tolerance of ${expected}`);
    });

    // --- Input Validation Tests ---

    test('should return NaN if any input is NaN', () => {
        assert.ok(Number.isNaN(calculateHaversineDistance(NaN, 0, 0, 0)));
        assert.ok(Number.isNaN(calculateHaversineDistance(0, NaN, 0, 0)));
        assert.ok(Number.isNaN(calculateHaversineDistance(0, 0, NaN, 0)));
        assert.ok(Number.isNaN(calculateHaversineDistance(0, 0, 0, NaN)));
    });

    test('should return NaN for null inputs', () => {
        assert.ok(Number.isNaN(calculateHaversineDistance(null, 0, 0, 0)));
        assert.ok(Number.isNaN(calculateHaversineDistance(0, null, 0, 0)));
    });

    test('should return NaN for undefined inputs', () => {
        assert.ok(Number.isNaN(calculateHaversineDistance(undefined, 0, 0, 0)));
        assert.ok(Number.isNaN(calculateHaversineDistance(0, undefined, 0, 0)));
    });

    test('should return NaN for non-numeric strings', () => {
        assert.ok(Number.isNaN(calculateHaversineDistance("48.85", 0, 0, 0)));
        assert.ok(Number.isNaN(calculateHaversineDistance(0, "2.35", 0, 0)));
        assert.ok(Number.isNaN(calculateHaversineDistance("abc", 0, 0, 0)));
    });

    test('should return NaN for Infinity', () => {
        assert.ok(Number.isNaN(calculateHaversineDistance(Infinity, 0, 0, 0)));
        assert.ok(Number.isNaN(calculateHaversineDistance(0, -Infinity, 0, 0)));
    });

    // --- Geographic Edge Case Tests ---

    test('should handle Date Line crossing (179E to 179W)', () => {
        // Distance between 179°E and 179°W on equator is 2 degrees = ~222km
        const lat = 0;
        const lon1 = 179;
        const lon2 = -179;
        const result = calculateHaversineDistance(lat, lon1, lat, lon2);

        const expected = 222390; // Approx 2 degrees
        const tolerance = 1000;

        assert.ok(Math.abs(result - expected) < tolerance, `Distance ${result} is not within tolerance of ${expected}`);
    });

    test('should handle poles correctly', () => {
        // Distance between North Pole and a point 1 degree away from it
        // North Pole is 90°N. Longitude is irrelevant at the pole.
        // Point at 89°N.
        const result = calculateHaversineDistance(90, 0, 89, 0);
        const expected = 111195; // 1 degree of latitude
        const tolerance = 100;

        assert.ok(Math.abs(result - expected) < tolerance, `Distance ${result} is not within tolerance of ${expected}`);

        // Distance between North Pole (90, 0) and North Pole with different longitude (90, 180) should be 0
        const zeroDistance = calculateHaversineDistance(90, 0, 90, 180);
        assert.ok(zeroDistance < 1e-9, `Expected distance 0 at pole, got ${zeroDistance}`);
    });

    test('should handle antipodes', () => {
        // Distance between (0, 0) and (0, 180) is half circumference ~20,000km
        const result = calculateHaversineDistance(0, 0, 0, 180);
        const expected = 20015000; // Half equator approx 20,037 km?
        // Let's use PI * R = 3.14159 * 6371e3 = 20,015,086 meters
        const tolerance = 10000;

        assert.ok(Math.abs(result - 20015086) < tolerance, `Distance ${result} is not within tolerance of antipodes`);
    });
});
