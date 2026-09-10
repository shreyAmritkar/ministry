// ============================================
// services/sseService.js
// Server-Sent Events connection manager.
//
// Replaces Socket.IO for this app's needs, which are entirely
// server -> client push (notifications, report updates) with no
// client -> server real-time channel required. Each open HTTP
// response IS the "connection" — we just keep it open and write
// `event:`/`data:` frames to it as things happen.
// ============================================

// Every currently-open stream, with enough metadata to route to it.
// { res, userId, role, reportId }
const connections = new Set();

const HEARTBEAT_INTERVAL_MS = 25000; // keep proxies/load balancers from timing out an idle connection

function writeEvent(res, event, data) {
    try {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
        // Connection already gone — the close listener registered in
        // registerConnection() will clean it up; nothing else to do here.
    }
}

/**
 * Registers a new SSE connection. Call once per incoming request,
 * after writing the SSE response headers.
 *
 * @param {object} res - the Express response, kept open
 * @param {object} meta - { userId, role, reportId } — whichever apply
 * @returns {function} unregister — call this on the request's 'close' event
 */
function registerConnection(res, meta = {}) {
    const connection = { res, ...meta };
    connections.add(connection);

    const heartbeat = setInterval(() => {
        try {
            res.write(': heartbeat\n\n'); // SSE comment line — ignored by EventSource, just keeps the pipe alive
        } catch (error) {
            clearInterval(heartbeat);
        }
    }, HEARTBEAT_INTERVAL_MS);
    heartbeat.unref(); // never let this timer alone keep the Node process alive
                       // (e.g. during graceful shutdown or if a client's 'close'
                       // event is ever delayed/missed) — the real listening
                       // socket already holds the process open in production.

    return function unregister() {
        clearInterval(heartbeat);
        connections.delete(connection);
    };
}

/** Push an event to every stream opened by a specific user (all their open tabs/devices). */
function sendToUser(userId, event, data) {
    for (const conn of connections) {
        if (conn.userId === String(userId)) {
            writeEvent(conn.res, event, data);
        }
    }
}

/** Push an event to every connected user with a given role (was Socket.IO's `role:*` room). */
function broadcastToRole(role, event, data) {
    for (const conn of connections) {
        if (conn.role === role) {
            writeEvent(conn.res, event, data);
        }
    }
}

/** Push an event to everyone currently viewing a specific report's detail page. */
function sendToReport(reportId, event, data) {
    for (const conn of connections) {
        if (conn.reportId === String(reportId)) {
            writeEvent(conn.res, event, data);
        }
    }
}

/** Called on graceful shutdown so open connections end cleanly instead of hanging. */
function closeAll() {
    for (const conn of connections) {
        try {
            conn.res.end();
        } catch (error) {
            // already closed — ignore
        }
    }
    connections.clear();
}

module.exports = {
    registerConnection,
    sendToUser,
    broadcastToRole,
    sendToReport,
    closeAll,
};
