/**
 * Factory de mock pour src/config/db.
 * À utiliser avec jest.mock('../../src/config/db', () => require('../helpers/db').createDbMock());
 * puis, dans le test :
 *    const db = require('../../src/config/db');
 *    db.query.mockResolvedValueOnce({ rows: [...], rowCount: 1 });
 */
function createDbMock() {
    const client = {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        release: jest.fn(),
    };
    return {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        getClient: jest.fn().mockResolvedValue(client),
        __client: client,
    };
}

module.exports = { createDbMock };
