// ============================================
// test/manual/upload-memory-benchmark.js
//
// NOT a jest test — a standalone script that spins up the real
// uploadMiddleware (multer, memoryStorage) behind a throwaway Express
// route and fires uploads of increasing size at it over real HTTP
// (loopback), measuring:
//   - wall-clock time for the request to complete
//   - process RSS / heap-used delta before vs after
//   - peak heap sampled during the request
//
// This exists to put real numbers behind the claim that memoryStorage
// buffers the ENTIRE file into RAM before the app can act on it, which
// is the main argument for moving to streamed/disk storage or direct
// presigned-URL uploads for anything beyond small images.
//
// Run: node test/manual/upload-memory-benchmark.js
// ============================================
const http = require('http');
const express = require('express');
const { upload } = require('../../middleware/uploadMiddleware');

const SIZES_MB = [1, 10, 50, 100, 250];

function buildApp() {
    const app = express();
    app.post('/upload', upload.single('media'), (req, res) => {
        res.json({ received: req.file ? req.file.size : 0 });
    });
    // Multer error handler (oversized/invalid files)
    app.use((err, req, res, next) => {
        res.status(400).json({ error: err.message });
    });
    return app;
}

function sample() {
    const mem = process.memoryUsage();
    return { rss: mem.rss, heapUsed: mem.heapUsed };
}

function fmtMB(bytes) {
    return (bytes / 1024 / 1024).toFixed(1) + 'MB';
}

async function uploadOnce(port, sizeMB) {
    const boundary = '----benchmark' + Date.now();
    const fileBuf = Buffer.alloc(sizeMB * 1024 * 1024, 0x61); // filled buffer, not sparse

    const preamble = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="clip.mp4"\r\nContent-Type: video/mp4\r\n\r\n`
    );
    const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([preamble, fileBuf, epilogue]);

    // Sample memory just before firing, and poll during the request.
    let peakHeap = sample().heapUsed;
    const pollHandle = setInterval(() => {
        const h = sample().heapUsed;
        if (h > peakHeap) peakHeap = h;
    }, 5);

    const before = sample();
    const t0 = process.hrtime.bigint();

    await new Promise((resolve, reject) => {
        const req = http.request(
            {
                host: 'localhost',
                port,
                path: '/upload',
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': body.length,
                },
            },
            (res) => {
                res.on('data', () => {});
                res.on('end', resolve);
            }
        );
        req.on('error', reject);
        req.write(body);
        req.end();
    });

    const t1 = process.hrtime.bigint();
    clearInterval(pollHandle);
    const after = sample();

    return {
        sizeMB,
        ms: Number(t1 - t0) / 1e6,
        rssDeltaMB: (after.rss - before.rss) / 1024 / 1024,
        heapDeltaMB: (after.heapUsed - before.heapUsed) / 1024 / 1024,
        peakHeapMB: peakHeap / 1024 / 1024,
    };
}

async function main() {
    const app = buildApp();
    const server = app.listen(0);
    const port = server.address().port;

    console.log('size\ttime(ms)\tRSS Δ\theap Δ\tpeak heap');
    const results = [];
    for (const sizeMB of SIZES_MB) {
        if (global.gc) global.gc(); // run with --expose-gc for cleaner deltas
        const r = await uploadOnce(port, sizeMB);
        results.push(r);
        console.log(
            `${r.sizeMB}MB\t${r.ms.toFixed(1)}ms\t${r.rssDeltaMB.toFixed(1)}MB\t${r.heapDeltaMB.toFixed(1)}MB\t${r.peakHeapMB.toFixed(1)}MB`
        );
    }

    server.close();
    console.log('\nDone. Raw results:');
    console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
