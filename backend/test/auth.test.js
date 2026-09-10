// ============================================
// test/auth.test.js
// Integration tests against a real PostgreSQL database for the
// access-token / refresh-token architecture described in
// controllers/authController.js and models/RefreshToken.js.
// ============================================
const request = require('supertest');
const { app } = require('../server');
const { resetDb, closeDb } = require('./setup/db');

const credentials = { name: 'Test User', email: 'test@example.com', password: 'pass1234' };

describe('Auth flow', () => {
    beforeEach(async () => {
        await resetDb();
    });

    afterAll(async () => {
        await closeDb();
    });

    test('register creates a user and returns access + refresh tokens, never the password', async () => {
        const res = await request(app).post('/api/v1/auth/register').send(credentials);

        expect(res.status).toBe(201);
        expect(res.body.data.user.email).toBe(credentials.email);
        expect(res.body.data.accessToken).toEqual(expect.any(String));
        expect(res.body.data.refreshToken).toEqual(expect.any(String));
        expect(res.body.data.user.password).toBeUndefined();
    });

    test('register rejects a duplicate email', async () => {
        await request(app).post('/api/v1/auth/register').send(credentials);
        const res = await request(app).post('/api/v1/auth/register').send(credentials);
        expect(res.status).toBe(400);
    });

    test('login rejects a wrong password', async () => {
        await request(app).post('/api/v1/auth/register').send(credentials);
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: credentials.email, password: 'wrong-password' });
        expect(res.status).toBe(401);
    });

    test('login returns tokens, and the access token works on a protected route', async () => {
        await request(app).post('/api/v1/auth/register').send(credentials);
        const loginRes = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: credentials.email, password: credentials.password });

        expect(loginRes.status).toBe(200);
        const { accessToken } = loginRes.body.data;

        const meRes = await request(app)
            .get('/api/v1/auth/me')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(meRes.status).toBe(200);
        expect(meRes.body.data.email).toBe(credentials.email);
    });

    test('protected route rejects a missing or invalid token', async () => {
        const noToken = await request(app).get('/api/v1/auth/me');
        expect(noToken.status).toBe(401);

        const badToken = await request(app)
            .get('/api/v1/auth/me')
            .set('Authorization', 'Bearer not-a-real-token');
        expect(badToken.status).toBe(401);
    });

    test('refresh-token rotates: the old refresh token stops working, the new one works', async () => {
        await request(app).post('/api/v1/auth/register').send(credentials);
        const loginRes = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: credentials.email, password: credentials.password });
        const { refreshToken } = loginRes.body.data;

        const refreshRes = await request(app).post('/api/v1/auth/refresh-token').send({ refreshToken });
        expect(refreshRes.status).toBe(200);
        expect(refreshRes.body.data.accessToken).toEqual(expect.any(String));
        expect(refreshRes.body.data.refreshToken).toEqual(expect.any(String));
        expect(refreshRes.body.data.refreshToken).not.toBe(refreshToken);

        // Reusing the OLD refresh token should now be rejected — this is
        // what proves rotation (not just re-validation) is happening.
        const reuseRes = await request(app).post('/api/v1/auth/refresh-token').send({ refreshToken });
        expect(reuseRes.status).toBe(401);

        // The NEW refresh token should work.
        const newRefreshRes = await request(app)
            .post('/api/v1/auth/refresh-token')
            .send({ refreshToken: refreshRes.body.data.refreshToken });
        expect(newRefreshRes.status).toBe(200);
    });

    test('refresh-token rejects a garbage token', async () => {
        const res = await request(app)
            .post('/api/v1/auth/refresh-token')
            .send({ refreshToken: 'this-was-never-issued' });
        expect(res.status).toBe(401);
    });

    test('logout revokes the refresh token in the database', async () => {
        await request(app).post('/api/v1/auth/register').send(credentials);
        const loginRes = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: credentials.email, password: credentials.password });
        const { refreshToken } = loginRes.body.data;

        const logoutRes = await request(app).post('/api/v1/auth/logout').send({ refreshToken });
        expect(logoutRes.status).toBe(200);

        const refreshAfterLogout = await request(app)
            .post('/api/v1/auth/refresh-token')
            .send({ refreshToken });
        expect(refreshAfterLogout.status).toBe(401);
    });

    test('logout-all revokes every refresh token for the user, across sessions', async () => {
        await request(app).post('/api/v1/auth/register').send(credentials);
        const session1 = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: credentials.email, password: credentials.password });
        const session2 = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: credentials.email, password: credentials.password });

        const logoutAllRes = await request(app)
            .post('/api/v1/auth/logout-all')
            .set('Authorization', `Bearer ${session1.body.data.accessToken}`);
        expect(logoutAllRes.status).toBe(200);

        const refresh1 = await request(app)
            .post('/api/v1/auth/refresh-token')
            .send({ refreshToken: session1.body.data.refreshToken });
        const refresh2 = await request(app)
            .post('/api/v1/auth/refresh-token')
            .send({ refreshToken: session2.body.data.refreshToken });

        expect(refresh1.status).toBe(401);
        expect(refresh2.status).toBe(401);
    });

    test('update-password revokes existing refresh tokens and invalidates the old password', async () => {
        await request(app).post('/api/v1/auth/register').send(credentials);
        const loginRes = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: credentials.email, password: credentials.password });
        const { accessToken, refreshToken } = loginRes.body.data;

        const updateRes = await request(app)
            .patch('/api/v1/auth/update-password')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ currentPassword: credentials.password, newPassword: 'newpass1234' });
        expect(updateRes.status).toBe(200);

        const oldRefreshAttempt = await request(app)
            .post('/api/v1/auth/refresh-token')
            .send({ refreshToken });
        expect(oldRefreshAttempt.status).toBe(401);

        const oldPasswordLogin = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: credentials.email, password: credentials.password });
        expect(oldPasswordLogin.status).toBe(401);

        const newPasswordLogin = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: credentials.email, password: 'newpass1234' });
        expect(newPasswordLogin.status).toBe(200);
    });

    test('a non-admin cannot self-elevate to official via the request body (403)', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ ...credentials, userType: 'official' });

        // No Authorization header attached => req.user is undefined =>
        // requestingUserRole !== 'admin' => any non-'citizen' userType in
        // the body is correctly rejected outright, rather than silently
        // downgraded to citizen.
        expect(res.status).toBe(403);
    });
});
