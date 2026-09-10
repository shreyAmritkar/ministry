// ============================================
// test/reports.test.js
// Integration tests for report creation, PostGIS storage, nearby
// search, upvoting, and status-update authorization.
//
// assignmentHelper is mocked because it calls the real, external
// Nominatim reverse-geocoding API — a live third-party network
// dependency has no place in a test suite that should run offline
// and deterministically.
// ============================================
jest.mock('../utils/assignmentHelper', () => ({
    assignReportToOfficial: jest.fn().mockResolvedValue({
        official_id: null,
        tenure_id: null,
        city: 'TestCity',
    }),
}));

const request = require('supertest');
const { app } = require('../server');
const { resetDb, closeDb, pool } = require('./setup/db');
const { createUser } = require('./setup/factories');

const reportPayload = {
    title: 'Pothole on Main St',
    description: 'Large pothole causing traffic issues near the market area',
    category: 'Road_Damage',
    location: { type: 'Point', coordinates: [78.4867, 17.385] },
};

describe('Reports', () => {
    let citizenToken;

    beforeEach(async () => {
        await resetDb();
        await request(app).post('/api/v1/auth/register').send({
            name: 'Citizen', email: 'citizen@test.com', password: 'pass1234',
        });
        const login = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'citizen@test.com', password: 'pass1234' });
        citizenToken = login.body.data.accessToken;
    });

    afterAll(async () => {
        await closeDb();
    });

    test('creates a report and stores the exact coordinates via PostGIS', async () => {
        const res = await request(app)
            .post('/api/v1/reports')
            .set('Authorization', `Bearer ${citizenToken}`)
            .send(reportPayload);

        expect(res.status).toBe(201);
        const reportId = res.body.data.report._id;

        // Bypass the model layer entirely and ask Postgres directly what
        // it actually stored — this is the real proof the geography
        // column + ST_MakePoint insertion works, not just that the API
        // echoed back what we sent.
        const { rows } = await pool.query(
            `SELECT ST_X(location::geometry) AS lon, ST_Y(location::geometry) AS lat FROM reports WHERE id = $1`,
            [reportId]
        );
        expect(rows[0].lon).toBeCloseTo(78.4867, 3);
        expect(rows[0].lat).toBeCloseTo(17.385, 3);
    });

    test('rejects a report missing location coordinates', async () => {
        const { location, ...withoutLocation } = reportPayload;
        const res = await request(app)
            .post('/api/v1/reports')
            .set('Authorization', `Bearer ${citizenToken}`)
            .send(withoutLocation);
        expect(res.status).toBe(400);
    });

    test('nearby search finds a report created at that location', async () => {
        const createRes = await request(app)
            .post('/api/v1/reports')
            .set('Authorization', `Bearer ${citizenToken}`)
            .send(reportPayload);
        const reportId = createRes.body.data.report._id;

        const res = await request(app)
            .get('/api/v1/reports/nearby')
            .query({ latitude: 17.385, longitude: 78.4867, maxDistance: 5000 });

        expect(res.status).toBe(200);
        expect(res.body.data.some((r) => r._id === reportId)).toBe(true);
    });

    test('nearby search does NOT find a report 100km away', async () => {
        await request(app)
            .post('/api/v1/reports')
            .set('Authorization', `Bearer ${citizenToken}`)
            .send(reportPayload); // Hyderabad-ish coordinates

        // Roughly Bangalore — well outside a 5km radius from Hyderabad
        const res = await request(app)
            .get('/api/v1/reports/nearby')
            .query({ latitude: 12.9716, longitude: 77.5946, maxDistance: 5000 });

        expect(res.status).toBe(200);
        expect(res.body.data.length).toBe(0);
    });

    test('upvoting twice by the same user only counts once', async () => {
        const createRes = await request(app)
            .post('/api/v1/reports')
            .set('Authorization', `Bearer ${citizenToken}`)
            .send(reportPayload);
        const reportId = createRes.body.data.report._id;

        const first = await request(app)
            .patch(`/api/v1/reports/${reportId}/upvote`)
            .set('Authorization', `Bearer ${citizenToken}`);
        expect(first.body.data.upvotes).toBe(1);

        const second = await request(app)
            .patch(`/api/v1/reports/${reportId}/upvote`)
            .set('Authorization', `Bearer ${citizenToken}`);
        expect(second.body.data.upvotes).toBe(1); // not 2 — ON CONFLICT DO NOTHING held
    });

    test('a citizen cannot update report status (403)', async () => {
        const createRes = await request(app)
            .post('/api/v1/reports')
            .set('Authorization', `Bearer ${citizenToken}`)
            .send(reportPayload);
        const reportId = createRes.body.data.report._id;

        const res = await request(app)
            .patch(`/api/v1/reports/${reportId}/status`)
            .set('Authorization', `Bearer ${citizenToken}`)
            .send({ status: 'Acknowledged' });
        expect(res.status).toBe(403);
    });

    test('an official CAN update report status, and it is recorded in status history', async () => {
        await createUser({ email: 'official@test.com', role: 'official', userType: 'official' });
        const officialLogin = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'official@test.com', password: 'pass1234' });
        const officialToken = officialLogin.body.data.accessToken;

        const createRes = await request(app)
            .post('/api/v1/reports')
            .set('Authorization', `Bearer ${citizenToken}`)
            .send(reportPayload);
        const reportId = createRes.body.data.report._id;

        const res = await request(app)
            .patch(`/api/v1/reports/${reportId}/status`)
            .set('Authorization', `Bearer ${officialToken}`)
            .send({ status: 'Acknowledged', comment: 'Looking into it' });

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('Acknowledged');

        const { rows } = await pool.query(
            `SELECT status, comment FROM report_status_history WHERE report_id = $1 ORDER BY "timestamp" ASC`,
            [reportId]
        );
        // one row from creation (Pending), one from this update (Acknowledged)
        expect(rows.map((r) => r.status)).toEqual(['Pending', 'Acknowledged']);
        expect(rows[1].comment).toBe('Looking into it');
    });

    // KNOWN BUG (see authController/authorize discussion): authorizeOfficialOrAdmin
    // checks `req.user.userType !== 'admin'`, but userType is NEVER 'admin' —
    // admin-ness lives only in `role`. So an admin whose userType is 'citizen'
    // (the only way admins are created — see seed/createAdmin.js) is incorrectly
    // blocked here. This test documents CURRENT behavior, not desired behavior;
    // it should start failing (and can be flipped to expect 200) once
    // middleware/authorize.js's authorizeOfficialOrAdmin is fixed.
    test('an admin is currently blocked from status updates too — known bug', async () => {
        await createUser({ email: 'admin2@test.com', role: 'admin', userType: 'citizen' });
        const adminLogin = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'admin2@test.com', password: 'pass1234' });
        const adminToken = adminLogin.body.data.accessToken;

        const createRes = await request(app)
            .post('/api/v1/reports')
            .set('Authorization', `Bearer ${citizenToken}`)
            .send(reportPayload);
        const reportId = createRes.body.data.report._id;

        const res = await request(app)
            .patch(`/api/v1/reports/${reportId}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'Acknowledged' });

        expect(res.status).toBe(403);
    });
});
