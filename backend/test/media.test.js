// ============================================
// test/media.test.js
// Integration tests for POST /api/v1/media/upload, GET /stream/:fileId,
// and DELETE /:storageType/:id.
//
// Cloudinary and GridFS are mocked: this sandbox has no real Cloudinary
// account or MongoDB instance, and hitting a real third-party media API
// from a test suite would be slow, flaky, and non-deterministic anyway
// (same rationale as assignmentHelper being mocked in reports.test.js).
// What we CAN verify for real: multipart parsing via Multer, mimetype
// filtering, size-limit enforcement, auth gating, and correct routing
// between the two storage backends based on file size/type.
// ============================================
jest.mock('../services/hybridMediaService', () => ({
    determineStorageType: jest.requireActual('../services/hybridMediaService').determineStorageType,
    uploadToCloudinary: jest.fn(),
    uploadToGridFS: jest.fn(),
    deleteFromCloudinary: jest.fn(),
    deleteFromGridFS: jest.fn(),
    getGridFSStream: jest.fn(),
    getGridFSMetadata: jest.fn(),
}));

const request = require('supertest');
const { app } = require('../server');
const { resetDb, closeDb } = require('./setup/db');
const { createUser } = require('./setup/factories');
const hybridMediaService = require('../services/hybridMediaService');
const { ALLOWED_MIME_TYPES } = require('../middleware/uploadMiddleware');

// Minimal valid file signatures so real mimetype sniffing (if any) and
// multer's own handling have something realistic to chew on.
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('Media upload', () => {
    let token;

    beforeEach(async () => {
        await resetDb();
        jest.resetAllMocks(); // clearAllMocks() only wipes call history, not
        // mockResolvedValue() implementations set by a PRIOR test — that gap
        // let test #7 below silently pass using test #5's stale GridFS mock
        // instead of exercising the size limit it claimed to test. resetAllMocks
        // wipes implementations too, so every test must set up its own mocks.
        await request(app).post('/api/v1/auth/register').send({
            name: 'Uploader', email: 'uploader@test.com', password: 'pass1234',
        });
        const login = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'uploader@test.com', password: 'pass1234' });
        token = login.body.data.accessToken;
    });

    afterAll(async () => {
        await closeDb();
    });

    test('rejects upload with no auth token', async () => {
        const res = await request(app)
            .post('/api/v1/media/upload')
            .attach('media', PNG_HEADER, { filename: 'photo.png', contentType: 'image/png' });

        expect(res.status).toBe(401);
    });

    test('rejects request with no file attached', async () => {
        const res = await request(app)
            .post('/api/v1/media/upload')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(400);
    });

    test('rejects disallowed mimetype (e.g. a PDF)', async () => {
        const res = await request(app)
            .post('/api/v1/media/upload')
            .set('Authorization', `Bearer ${token}`)
            .attach('media', Buffer.from('%PDF-1.4'), { filename: 'doc.pdf', contentType: 'application/pdf' });

        expect(res.status).toBe(400);
        expect(hybridMediaService.uploadToCloudinary).not.toHaveBeenCalled();
    });

    test('routes a small image to Cloudinary', async () => {
        hybridMediaService.uploadToCloudinary.mockResolvedValue({
            url: 'https://res.cloudinary.com/demo/image/upload/v1/civictrack/images/test.png',
            publicId: 'civictrack/images/test',
            format: 'png',
            size: PNG_HEADER.length,
            width: 1, height: 1,
        });

        const res = await request(app)
            .post('/api/v1/media/upload')
            .set('Authorization', `Bearer ${token}`)
            .attach('media', PNG_HEADER, { filename: 'photo.png', contentType: 'image/png' });

        expect(res.status).toBe(201);
        expect(res.body.data.storageType).toBe('cloudinary');
        expect(hybridMediaService.uploadToCloudinary).toHaveBeenCalledTimes(1);
        expect(hybridMediaService.uploadToGridFS).not.toHaveBeenCalled();
    });

    test('routes a video >= 10MB to GridFS', async () => {
        hybridMediaService.uploadToGridFS.mockResolvedValue({
            fileId: '507f1f77bcf86cd799439011',
            fileName: 'clip.mp4',
            size: 11 * 1024 * 1024,
            contentType: 'video/mp4',
        });

        const bigVideo = Buffer.alloc(11 * 1024 * 1024, 1); // 11MB, above the 10MB threshold

        const res = await request(app)
            .post('/api/v1/media/upload')
            .set('Authorization', `Bearer ${token}`)
            .attach('media', bigVideo, { filename: 'clip.mp4', contentType: 'video/mp4' });

        expect(res.status).toBe(201);
        expect(res.body.data.storageType).toBe('gridfs');
        expect(res.body.data.mediaUrl).toBe('/api/v1/media/stream/507f1f77bcf86cd799439011');
        expect(hybridMediaService.uploadToGridFS).toHaveBeenCalledTimes(1);
        expect(hybridMediaService.uploadToCloudinary).not.toHaveBeenCalled();
    });

    test('routes a video < 10MB to Cloudinary, not GridFS', async () => {
        hybridMediaService.uploadToCloudinary.mockResolvedValue({
            url: 'https://res.cloudinary.com/demo/video/upload/v1/civictrack/videos/test.mp4',
            publicId: 'civictrack/videos/test',
            format: 'mp4',
            size: 5 * 1024 * 1024,
            width: 640, height: 480,
            duration: 3.2,
        });

        const smallVideo = Buffer.alloc(5 * 1024 * 1024, 1);

        const res = await request(app)
            .post('/api/v1/media/upload')
            .set('Authorization', `Bearer ${token}`)
            .attach('media', smallVideo, { filename: 'clip.mp4', contentType: 'video/mp4' });

        expect(res.status).toBe(201);
        expect(res.body.data.storageType).toBe('cloudinary');
    });

    test('rejects an image over MAX_IMAGE_SIZE even though multer already accepted it', async () => {
        // Multer's own `limits.fileSize` is set to FILE_SIZE_LIMITS.VIDEO_GRIDFS
        // (500MB) as the ONE ceiling for every upload regardless of mimetype
        // (see uploadMiddleware.js). The tighter 10MB image cap is only
        // re-checked afterwards, in the controller, against `req.file.size`
        // — meaning the full oversized image already finished uploading
        // into server memory before being rejected. That's the buffering
        // cost this test proves exists, not a limit multer itself enforces.
        const overImageLimit = Buffer.alloc(10 * 1024 * 1024 + 1, 1); // 1 byte over MAX_IMAGE_SIZE

        const res = await request(app)
            .post('/api/v1/media/upload')
            .set('Authorization', `Bearer ${token}`)
            .attach('media', overImageLimit, { filename: 'huge.png', contentType: 'image/png' });

        expect(res.status).toBe(400);
        expect(hybridMediaService.uploadToCloudinary).not.toHaveBeenCalled();
    });

    test('does enforce multer\'s absolute ceiling (FILE_SIZE_LIMITS.VIDEO_GRIDFS) regardless of mimetype', async () => {
        // .env.test sets MAX_GRIDFS_VIDEO_SIZE=524288000 (500MB), which is
        // multer's hard ceiling for every request. Allocating a real 500MB+
        // buffer per test run is too heavy to do routinely, so this is
        // skipped by default — kept here as executable documentation of
        // the boundary, runnable manually with RUN_HEAVY_TESTS=1.
        if (!process.env.RUN_HEAVY_TESTS) {
            return;
        }
        const overHardLimit = Buffer.alloc(500 * 1024 * 1024 + 1, 1);
        const res = await request(app)
            .post('/api/v1/media/upload')
            .set('Authorization', `Bearer ${token}`)
            .attach('media', overHardLimit, { filename: 'huge.mp4', contentType: 'video/mp4' });
        expect([400, 413]).toContain(res.status);
    });

    test('propagates a Cloudinary failure as a 500 without leaking internals as 2xx', async () => {
        hybridMediaService.uploadToCloudinary.mockRejectedValue(new Error('Cloudinary upload failed: network error'));

        const res = await request(app)
            .post('/api/v1/media/upload')
            .set('Authorization', `Bearer ${token}`)
            .attach('media', PNG_HEADER, { filename: 'photo.png', contentType: 'image/png' });

        expect(res.status).toBe(500);
    });

    test('DELETE rejects an unknown storage type', async () => {
        const res = await request(app)
            .delete('/api/v1/media/dropbox/some-id')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(400);
    });

    test('DELETE requires auth', async () => {
        const res = await request(app).delete('/api/v1/media/cloudinary/some-id');
        expect(res.status).toBe(401);
    });
});

describe('hybridMediaService.determineStorageType (pure logic, unmocked)', () => {
    // Re-require the REAL module here — the describe block above mocks
    // it at the module-registry level for the whole file, so pull the
    // actual implementation back out explicitly.
    const real = jest.requireActual('../services/hybridMediaService');

    test('any image always goes to cloudinary, regardless of size', () => {
        expect(real.determineStorageType(1, 'image/png')).toBe('cloudinary');
        expect(real.determineStorageType(50 * 1024 * 1024, 'image/jpeg')).toBe('cloudinary');
    });

    test('video under 10MB goes to cloudinary', () => {
        expect(real.determineStorageType(10 * 1024 * 1024 - 1, 'video/mp4')).toBe('cloudinary');
    });

    test('video at/over 10MB goes to gridfs', () => {
        expect(real.determineStorageType(10 * 1024 * 1024, 'video/mp4')).toBe('gridfs');
        expect(real.determineStorageType(500 * 1024 * 1024, 'video/mp4')).toBe('gridfs');
    });

    test('unsupported mimetype throws', () => {
        expect(() => real.determineStorageType(100, 'application/pdf')).toThrow('Unsupported file type');
    });
});

describe('uploadMiddleware config sanity', () => {
    test('allowed mimetypes cover the expected image and video formats', () => {
        expect(ALLOWED_MIME_TYPES.IMAGE).toEqual(
            expect.arrayContaining(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
        );
        expect(ALLOWED_MIME_TYPES.VIDEO).toEqual(
            expect.arrayContaining(['video/mp4', 'video/webm', 'video/quicktime'])
        );
    });
});
