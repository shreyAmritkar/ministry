module.exports = {
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/test/setup/mockGlobals.js'],
    testTimeout: 15000,
    testPathIgnorePatterns: ['/node_modules/'],
};
