"use strict";

/* =========================================================
   LEVEL SPEED V4
   HIZLI + STABIL SPEED TEST
   ========================================================= */

const CONFIG = {
    pingCount: 8,

    downloadDuration: 3000,
    uploadDuration: 3000,

    downloadStreams: 3,
    uploadStreams: 2,

    uploadChunkMB: 1,

    requestTimeout: 5000
};


/* =========================================================
   ELEMENTS
   ========================================================= */

const $ = id => document.getElementById(id);

const phase = $("phase");
const speedNumber = $("speedNumber");
const speedMode = $("speedMode");
const speedRing = $("speedRing");

const progressLabel = $("progressLabel");
const progressPercent = $("progressPercent");
const progressValue = $("progressValue");

const startButton = $("startButton");
const startText = $("startText");
const stopButton = $("stopButton");

const downloadEl = $("download");
const uploadEl = $("upload");
const pingEl = $("ping");
const jitterEl = $("jitter");

const liveSpeed = $("liveSpeed");

const chart = $("chartCanvas");
const chartEmpty = $("chartEmpty");

const scoreEl = $("score");
const qualityTitle = $("qualityTitle");
const qualityText = $("qualityText");

const ipEl = $("ip");
const connectionEl = $("connection");
const serverEl = $("server");


/* =========================================================
   STATE
   ========================================================= */

let running = false;
let controller = null;

let graph = [];

let lastSpeed = 0;

let downloadResult = 0;
let uploadResult = 0;
let pingResult = 0;
let jitterResult = 0;


/* =========================================================
   HELPERS
   ========================================================= */

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function token() {
    return (
        Date.now().toString(36) +
        Math.random().toString(36).slice(2)
    );
}


function number(value, decimals = 1) {
    if (!Number.isFinite(value)) {
        return "0";
    }

    return Number(value).toFixed(decimals);
}


function progress(value, label) {
    value = Math.max(0, Math.min(100, value));

    if (progressValue) {
        progressValue.style.width = `${value}%`;
    }

    if (progressPercent) {
        progressPercent.textContent =
            `${Math.round(value)}%`;
    }

    if (label && progressLabel) {
        progressLabel.textContent = label;
    }
}


function checkRunning() {
    if (!running) {
        throw new Error("Test durduruldu.");
    }
}


/* =========================================================
   GAUGE
   ========================================================= */

function setSpeed(value, mode = "") {

    value = Math.max(
        0,
        Number(value) || 0
    );

    lastSpeed = value;

    if (speedNumber) {
        speedNumber.textContent =
            value >= 100
                ? Math.round(value)
                : number(value, 1);
    }

    if (liveSpeed) {
        liveSpeed.textContent =
            `${number(value, 1)} Mbps`;
    }

    if (mode && speedMode) {
        speedMode.textContent = mode;
    }

    const percentage =
        Math.min(
            100,
            value /
            Math.max(100, value * 1.25) *
            100
        );

    const degrees =
        percentage * 2.8;

    if (speedRing) {
        speedRing.style.background = `
            conic-gradient(
                from 220deg,
                #36f28b 0deg,
                #36f28b ${degrees}deg,
                rgba(255,255,255,.05) ${degrees}deg,
                rgba(255,255,255,.05) 280deg,
                transparent 280deg
            )
        `;
    }
}


/* =========================================================
   GRAPH
   ========================================================= */

function resizeCanvas() {

    if (!chart) return;

    const rect =
        chart.getBoundingClientRect();

    if (!rect.width || !rect.height) {
        return;
    }

    const ratio =
        window.devicePixelRatio || 1;

    chart.width =
        rect.width * ratio;

    chart.height =
        rect.height * ratio;

    const ctx =
        chart.getContext("2d");

    ctx.setTransform(
        ratio,
        0,
        0,
        ratio,
        0,
        0
    );

    drawGraph();
}


function addGraph(value) {

    if (!Number.isFinite(value)) {
        return;
    }

    graph.push(
        Math.max(0, Number(value))
    );

    if (graph.length > 100) {
        graph.shift();
    }

    if (chartEmpty) {
        chartEmpty.style.display = "none";
    }

    drawGraph();
}


function drawGraph() {

    if (!chart) return;

    const rect =
        chart.getBoundingClientRect();

    const width = rect.width;
    const height = rect.height;

    if (!width || !height) {
        return;
    }

    const ctx =
        chart.getContext("2d");

    ctx.clearRect(
        0,
        0,
        width,
        height
    );

    ctx.strokeStyle =
        "rgba(255,255,255,.045)";

    ctx.lineWidth = 1;

    for (let i = 1; i < 5; i++) {

        const y =
            height * i / 5;

        ctx.beginPath();

        ctx.moveTo(0, y);
        ctx.lineTo(width, y);

        ctx.stroke();
    }

    if (graph.length < 2) {
        return;
    }

    const max =
        Math.max(
            10,
            ...graph
        ) * 1.15;

    const points =
        graph.map((value, index) => {

            const x =
                index /
                (graph.length - 1) *
                width;

            const y =
                height -
                (
                    value / max
                ) *
                (height - 15) -
                7;

            return { x, y };
        });


    /* AREA */

    ctx.beginPath();

    ctx.moveTo(
        points[0].x,
        height
    );

    for (const point of points) {
        ctx.lineTo(
            point.x,
            point.y
        );
    }

    ctx.lineTo(
        points[points.length - 1].x,
        height
    );

    ctx.closePath();

    const gradient =
        ctx.createLinearGradient(
            0,
            0,
            0,
            height
        );

    gradient.addColorStop(
        0,
        "rgba(54,242,139,.18)"
    );

    gradient.addColorStop(
        1,
        "rgba(54,242,139,0)"
    );

    ctx.fillStyle = gradient;
    ctx.fill();


    /* LINE */

    ctx.beginPath();

    points.forEach((point, index) => {

        if (index === 0) {

            ctx.moveTo(
                point.x,
                point.y
            );

        } else {

            ctx.lineTo(
                point.x,
                point.y
            );
        }
    });

    ctx.strokeStyle =
        "#36f28b";

    ctx.lineWidth = 2.5;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.stroke();
}


/* =========================================================
   SAFE FETCH
   ========================================================= */

async function fetchWithTimeout(
    url,
    options = {},
    timeout = CONFIG.requestTimeout
) {

    const localController =
        new AbortController();

    const timer =
        setTimeout(
            () => localController.abort(),
            timeout
        );

    try {

        const signal =
            options.signal;

        if (signal) {

            if (signal.aborted) {
                localController.abort();
            } else {

                signal.addEventListener(
                    "abort",
                    () => localController.abort(),
                    { once: true }
                );
            }
        }

        return await fetch(
            url,
            {
                ...options,
                signal:
                    localController.signal
            }
        );

    } finally {

        clearTimeout(timer);
    }
}


/* =========================================================
   PING
   ========================================================= */

async function testPing() {

    checkRunning();

    phase.textContent =
        "PING ÖLÇÜLÜYOR";

    speedMode.textContent =
        "PING";

    progress(
        5,
        "Sunucu gecikmesi ölçülüyor..."
    );

    const values = [];

    for (
        let i = 0;
        i < CONFIG.pingCount;
        i++
    ) {

        checkRunning();

        const start =
            performance.now();

        try {

            const response =
                await fetchWithTimeout(
                    `/api/ping?x=${token()}`,
                    {
                        cache: "no-store",
                        signal:
                            controller.signal
                    },
                    2000
                );

            if (!response.ok) {
                throw new Error("Ping başarısız.");
            }

            const result =
                performance.now() -
                start;

            values.push(result);

            progress(
                5 +
                (
                    (i + 1) /
                    CONFIG.pingCount
                ) * 10,
                `Ping ölçülüyor • ${Math.round(result)} ms`
            );

        } catch (error) {

            if (error.name === "AbortError") {
                throw error;
            }

            console.warn(
                "Ping hatası:",
                error
            );
        }

        await sleep(60);
    }

    if (!values.length) {
        throw new Error(
            "Ping ölçümü yapılamadı."
        );
    }

    const average =
        values.reduce(
            (a, b) => a + b,
            0
        ) / values.length;

    const jitterValues = [];

    for (
        let i = 1;
        i < values.length;
        i++
    ) {

        jitterValues.push(
            Math.abs(
                values[i] -
                values[i - 1]
            )
        );
    }

    const jitter =
        jitterValues.length
            ? jitterValues.reduce(
                (a, b) => a + b,
                0
            ) / jitterValues.length
            : 0;

    pingResult = average;
    jitterResult = jitter;

    pingEl.textContent =
        number(average);

    jitterEl.textContent =
        number(jitter);

    return {
        ping: average,
        jitter
    };
}


/* =========================================================
   DOWNLOAD WORKER
   ========================================================= */

async function downloadWorker(
    signal,
    onBytes
) {

    try {

        const response =
            await fetch(
                `/api/download?mb=50&x=${token()}`,
                {
                    cache: "no-store",
                    signal
                }
            );

        if (!response.ok) {
            throw new Error(
                "Download bağlantısı başarısız."
            );
        }

        if (!response.body) {
            throw new Error(
                "Tarayıcı veri akışını desteklemiyor."
            );
        }

        const reader =
            response.body.getReader();

        while (true) {

            const {
                done,
                value
            } = await reader.read();

            if (done) {
                break;
            }

            if (value) {

                onBytes(
                    value.byteLength
                );
            }
        }

    } catch (error) {

        if (
            error.name !==
            "AbortError"
        ) {
            console.warn(
                "Download worker:",
                error
            );
        }
    }
}


/* =========================================================
   DOWNLOAD
   ========================================================= */

async function testDownload() {

    checkRunning();

    phase.textContent =
        "DOWNLOAD ÖLÇÜLÜYOR";

    speedMode.textContent =
        "DOWNLOAD";

    progress(
        18,
        "İndirme hızı ölçülüyor..."
    );

    const start =
        performance.now();

    let totalBytes = 0;
    let previousBytes = 0;
    let previousTime = start;

    const phaseController =
        new AbortController();

    const abortTimer =
        setTimeout(
            () => phaseController.abort(),
            CONFIG.downloadDuration
        );

    const workers = [];

    for (
        let i = 0;
        i < CONFIG.downloadStreams;
        i++
    ) {

        workers.push(
            downloadWorker(
                phaseController.signal,
                bytes => {
                    totalBytes += bytes;
                }
            )
        );
    }

    const timer =
        setInterval(() => {

            const now =
                performance.now();

            const elapsed =
                (now - start) / 1000;

            const interval =
                (now - previousTime) / 1000;

            const intervalBytes =
                totalBytes -
                previousBytes;

            if (interval > 0) {

                const instant =
                    intervalBytes *
                    8 /
                    interval /
                    1000000;

                setSpeed(
                    instant,
                    "DOWNLOAD"
                );

                addGraph(instant);
            }

            previousBytes =
                totalBytes;

            previousTime =
                now;

            const percent =
                Math.min(
                    100,
                    elapsed /
                    (CONFIG.downloadDuration / 1000) *
                    100
                );

            progress(
                18 +
                percent * 0.42,
                `Download ölçülüyor • ${number(lastSpeed)} Mbps`
            );

        }, 120);

    try {

        await Promise.all(workers);

    } finally {

        phaseController.abort();

        clearTimeout(abortTimer);
        clearInterval(timer);
    }

    const elapsed =
        Math.max(
            0.1,
            (
                performance.now() -
                start
            ) / 1000
        );

    const speed =
        totalBytes *
        8 /
        elapsed /
        1000000;

    downloadResult = speed;

    downloadEl.textContent =
        number(speed);

    setSpeed(
        speed,
        "DOWNLOAD"
    );

    progress(
        60,
        `Download tamamlandı • ${number(speed)} Mbps`
    );

    return speed;
}


/* =========================================================
   UPLOAD DATA
   ========================================================= */

function createUploadChunk(
    megabytes
) {

    const bytes =
        megabytes *
        1024 *
        1024;

    const data =
        new Uint8Array(bytes);

    const block =
        new Uint8Array(
            64 * 1024
        );

    crypto.getRandomValues(
        block
    );

    for (
        let offset = 0;
        offset < bytes;
        offset += block.length
    ) {

        data.set(
            block.subarray(
                0,
                Math.min(
                    block.length,
                    bytes - offset
                )
            ),
            offset
        );
    }

    return data;
}


/* =========================================================
   UPLOAD WORKER
   ========================================================= */

async function uploadWorker(
    signal,
    onBytes
) {

    while (!signal.aborted) {

        try {

            const data =
                createUploadChunk(
                    CONFIG.uploadChunkMB
                );

            const response =
                await fetch(
                    `/api/upload?x=${token()}`,
                    {
                        method: "POST",
                        body: data,
                        cache: "no-store",
                        signal,
                        headers: {
                            "Content-Type":
                                "application/octet-stream"
                        }
                    }
                );

            if (!response.ok) {
                break;
            }

            const result =
                await response.json();

            if (
                result &&
                result.ok
            ) {

                onBytes(
                    result.bytes ||
                    data.byteLength
                );
            }

        } catch (error) {

            if (
                error.name ===
                "AbortError"
            ) {
                break;
            }

            console.warn(
                "Upload worker:",
                error
            );

            break;
        }
    }
}


/* =========================================================
   UPLOAD
   ========================================================= */

async function testUpload() {

    checkRunning();

    phase.textContent =
        "UPLOAD ÖLÇÜLÜYOR";

    speedMode.textContent =
        "UPLOAD";

    progress(
        61,
        "Yükleme hızı ölçülüyor..."
    );

    const start =
        performance.now();

    let totalBytes = 0;
    let previousBytes = 0;
    let previousTime = start;

    const phaseController =
        new AbortController();

    const timerAbort =
        setTimeout(
            () => phaseController.abort(),
            CONFIG.uploadDuration
        );

    const workers = [];

    for (
        let i = 0;
        i < CONFIG.uploadStreams;
        i++
    ) {

        workers.push(
            uploadWorker(
                phaseController.signal,
                bytes => {
                    totalBytes += bytes;
                }
            )
        );
    }

    const timer =
        setInterval(() => {

            const now =
                performance.now();

            const elapsed =
                (now - start) / 1000;

            const interval =
                (now - previousTime) / 1000;

            const bytes =
                totalBytes -
                previousBytes;

            if (interval > 0) {

                const speed =
                    bytes *
                    8 /
                    interval /
                    1000000;

                setSpeed(
                    speed,
                    "UPLOAD"
                );

                addGraph(speed);
            }

            previousBytes =
                totalBytes;

            previousTime =
                now;

            const percent =
                Math.min(
                    100,
                    elapsed /
                    (CONFIG.uploadDuration / 1000) *
                    100
                );

            progress(
                61 +
                percent * 0.38,
                `Upload ölçülüyor • ${number(lastSpeed)} Mbps`
            );

        }, 120);

    try {

        /*
         * Tam süre dolunca controller
         * upload isteklerini keser.
         */
        await sleep(
            CONFIG.uploadDuration
        );

    } finally {

        phaseController.abort();

        clearTimeout(timerAbort);
        clearInterval(timer);
    }

    const elapsed =
        Math.max(
            0.1,
            (
                performance.now() -
                start
            ) / 1000
        );

    const speed =
        totalBytes *
        8 /
        elapsed /
        1000000;

    uploadResult = speed;

    uploadEl.textContent =
        number(speed);

    setSpeed(
        speed,
        "UPLOAD"
    );

    progress(
        100,
        `Upload tamamlandı • ${number(speed)} Mbps`
    );

    return speed;
}


/* =========================================================
   SCORE
   ========================================================= */

function calculateScore(
    download,
    upload,
    ping,
    jitter
) {

    let score = 0;

    if (download >= 500)
        score += 40;
    else if (download >= 250)
        score += 36;
    else if (download >= 100)
        score += 32;
    else if (download >= 50)
        score += 27;
    else if (download >= 25)
        score += 20;
    else if (download >= 10)
        score += 12;
    else
        score += 5;

    if (upload >= 100)
        score += 25;
    else if (upload >= 50)
        score += 22;
    else if (upload >= 20)
        score += 18;
    else if (upload >= 10)
        score += 14;
    else if (upload >= 5)
        score += 9;
    else
        score += 4;

    if (ping <= 10)
        score += 20;
    else if (ping <= 20)
        score += 18;
    else if (ping <= 40)
        score += 15;
    else if (ping <= 70)
        score += 11;
    else if (ping <= 120)
        score += 7;
    else
        score += 2;

    if (jitter <= 5)
        score += 15;
    else if (jitter <= 10)
        score += 12;
    else if (jitter <= 20)
        score += 9;
    else if (jitter <= 40)
        score += 5;
    else
        score += 2;

    return Math.round(
        Math.min(100, score)
    );
}


function showQuality() {

    const score =
        calculateScore(
            downloadResult,
            uploadResult,
            pingResult,
            jitterResult
        );

    scoreEl.textContent =
        score;

    if (score >= 90) {

        qualityTitle.textContent =
            "Mükemmel bağlantı";

        qualityText.textContent =
            "Bağlantınız yüksek performans gösteriyor. Video, oyun ve yoğun internet kullanımı için oldukça iyi.";

    } else if (score >= 75) {

        qualityTitle.textContent =
            "Çok iyi bağlantı";

        qualityText.textContent =
            "Günlük kullanım ve yüksek kaliteli video için oldukça iyi bir bağlantınız var.";

    } else if (score >= 55) {

        qualityTitle.textContent =
            "İyi bağlantı";

        qualityText.textContent =
            "Bağlantınız günlük internet kullanımı için yeterli seviyede.";

    } else if (score >= 35) {

        qualityTitle.textContent =
            "Orta bağlantı";

        qualityText.textContent =
            "Yoğun kullanım sırasında hız veya gecikme problemleri yaşanabilir.";

    } else {

        qualityTitle.textContent =
            "Zayıf bağlantı";

        qualityText.textContent =
            "Bağlantınızda performans problemleri olabilir.";
    }
}


/* =========================================================
   NETWORK
   ========================================================= */

async function loadNetwork() {

    try {

        const response =
            await fetch(
                `/api/network-info?x=${token()}`,
                {
                    cache: "no-store"
                }
            );

        const data =
            await response.json();

        ipEl.textContent =
            data.ip ||
            "Bilinmiyor";

        serverEl.textContent =
            data.server ||
            "Test sunucusu";

    } catch {

        ipEl.textContent =
            "Bilinmiyor";

        serverEl.textContent =
            "Bilinmiyor";
    }

    const connection =
        navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection;

    if (!connection) {

        connectionEl.textContent =
            "Bilinmiyor";

        return;
    }

    const type =
        connection.type ||
        connection.effectiveType;

    const names = {
        wifi: "Wi-Fi",
        ethernet: "Ethernet",
        cellular: "Mobil",
        "5g": "5G",
        "4g": "4G",
        "3g": "3G",
        "2g": "2G"
    };

    connectionEl.textContent =
        names[type] ||
        type ||
        "Bilinmiyor";
}


/* =========================================================
   RESET
   ========================================================= */

function reset() {

    graph = [];

    downloadResult = 0;
    uploadResult = 0;
    pingResult = 0;
    jitterResult = 0;

    downloadEl.textContent = "—";
    uploadEl.textContent = "—";
    pingEl.textContent = "—";
    jitterEl.textContent = "—";

    scoreEl.textContent = "—";

    qualityTitle.textContent =
        "Henüz test edilmedi";

    qualityText.textContent =
        "İnternet bağlantınızın kalitesini görmek için testi başlatın.";

    if (chartEmpty) {
        chartEmpty.style.display = "flex";
    }

    setSpeed(
        0,
        "HAZIR"
    );

    progress(
        0,
        "Testi başlatmak için hazır."
    );

    drawGraph();
}


/* =========================================================
   START
   ========================================================= */

async function startTest() {

    if (running) {
        return;
    }

    running = true;

    controller =
        new AbortController();

    reset();

    startButton.disabled = true;
    startButton.style.opacity = ".55";

    stopButton.classList.remove(
        "hidden"
    );

    startText.textContent =
        "TEST ÇALIŞIYOR";

    try {

        await testPing();

        checkRunning();

        await testDownload();

        checkRunning();

        await testUpload();

        checkRunning();

        showQuality();

        phase.textContent =
            "TEST TAMAMLANDI";

        speedMode.textContent =
            "SONUÇ";

        progress(
            100,
            "Test tamamlandı."
        );

        startText.textContent =
            "TEKRAR TEST ET";

    } catch (error) {

        console.error(
            "Speed test error:",
            error
        );

        phase.textContent =
            running
                ? "TEST HATASI"
                : "TEST DURDURULDU";

        progressLabel.textContent =
            error.message ||
            "Test sırasında hata oluştu.";

        startText.textContent =
            "TEKRAR DENE";

    } finally {

        running = false;

        if (controller) {
            controller.abort();
        }

        controller = null;

        startButton.disabled = false;
        startButton.style.opacity = "1";

        stopButton.classList.add(
            "hidden"
        );
    }
}


/* =========================================================
   STOP
   ========================================================= */

function stopTest() {

    running = false;

    if (controller) {
        controller.abort();
    }

    phase.textContent =
        "TEST DURDURULDU";

    progressLabel.textContent =
        "Test durduruldu.";

    startText.textContent =
        "TEKRAR DENE";

    startButton.disabled = false;
    startButton.style.opacity = "1";

    stopButton.classList.add(
        "hidden"
    );
}


/* =========================================================
   EVENTS
   ========================================================= */

if (startButton) {

    startButton.addEventListener(
        "click",
        startTest
    );
}


if (stopButton) {

    stopButton.addEventListener(
        "click",
        stopTest
    );
}


window.addEventListener(
    "resize",
    resizeCanvas
);


/* =========================================================
   INIT
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        resizeCanvas();

        loadNetwork();

        reset();
    }
);