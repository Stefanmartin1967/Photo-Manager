import heic2any from 'heic2any';

self.onmessage = async ({ data: { id, blob } }) => {
    try {
        const result = await heic2any({ blob, toType: 'image/jpeg', quality: 0.8 });
        self.postMessage({ id, blob: Array.isArray(result) ? result[0] : result });
    } catch (err) {
        self.postMessage({ id, error: err.message });
    }
};
