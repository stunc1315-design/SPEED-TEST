from flask import Flask, render_template, jsonify, request, Response
import os
import socket
import secrets
import time

app = Flask(__name__)

DOWNLOAD_MAX_MB = 200
UPLOAD_MAX_MB = 100


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "version": "3.0"
    })


@app.route("/api/ping")
def ping():
    return jsonify({
        "ok": True,
        "time": time.time_ns()
    })


@app.route("/api/network-info")
def network_info():

    forwarded = request.headers.get("X-Forwarded-For")

    if forwarded:
        ip = forwarded.split(",")[0].strip()
    else:
        ip = request.remote_addr or "Bilinmiyor"

    try:
        hostname = socket.gethostname()
    except Exception:
        hostname = "Test Sunucusu"

    return jsonify({
        "ok": True,
        "ip": ip,
        "server": hostname
    })


@app.route("/api/download")
def download():

    try:
        mb = float(request.args.get("mb", 25))
    except (ValueError, TypeError):
        mb = 25

    mb = max(
        1,
        min(mb, DOWNLOAD_MAX_MB)
    )

    total_bytes = int(
        mb * 1024 * 1024
    )

    chunk_size = 256 * 1024

    def generate():

        remaining = total_bytes

        while remaining > 0:

            size = min(
                chunk_size,
                remaining
            )

            yield secrets.token_bytes(size)

            remaining -= size

    response = Response(
        generate(),
        mimetype="application/octet-stream"
    )

    response.headers["Content-Length"] = str(
        total_bytes
    )

    response.headers["Cache-Control"] = (
        "no-store, no-cache, must-revalidate, "
        "proxy-revalidate, max-age=0"
    )

    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    response.headers["Content-Encoding"] = "identity"
    response.headers["X-Content-Type-Options"] = "nosniff"

    return response


@app.route("/api/upload", methods=["POST"])
def upload():

    max_bytes = (
        UPLOAD_MAX_MB *
        1024 *
        1024
    )

    start = time.perf_counter()

    total = 0

    while True:

        chunk = request.stream.read(
            256 * 1024
        )

        if not chunk:
            break

        total += len(chunk)

        if total > max_bytes:

            return jsonify({
                "ok": False,
                "error": "Upload sınırı aşıldı."
            }), 413

    elapsed = (
        time.perf_counter() -
        start
    )

    return jsonify({
        "ok": True,
        "bytes": total,
        "seconds": elapsed
    })


if __name__ == "__main__":

    port = int(
        os.environ.get(
            "PORT",
            5000
        )
    )

    app.run(
        host="0.0.0.0",
        port=port,
        debug=True,
        threaded=True
    )