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

    test('should return NaN if any input is NaN', () => {
        assert.ok(Number.isNaN(calculateHaversineDistance(NaN, 0, 0, 0)));
        assert.ok(Number.isNaN(calculateHaversineDistance(0, NaN, 0, 0)));
        assert.ok(Number.isNaN(calculateHaversineDistance(0, 0, NaN, 0)));
        assert.ok(Number.isNaN(calculateHaversineDistance(0, 0, 0, NaN)));
    });

    test('should treat null as 0 due to JS coercion (current implementation behavior)', () => {
        // null will be coerced to 0 in math operations
        const result = calculateHaversineDistance(null, 0, 0, 0);
        assert.strictEqual(result, 0);
    });
});
