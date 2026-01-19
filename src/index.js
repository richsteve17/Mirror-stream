import express from 'express';
import { Server } from 'socket.io';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import http from 'http';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    transports: ["websocket"],
    maxHttpBufferSize: 1e8,
    pingTimeout: 60000,
    cors: { origin: "*" }
});

const port = process.env.PORT || 3000;

const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Mirror Stream</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; background: #000; overflow: hidden; height: 100vh; width: 100vw; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
        video { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); z-index: 1; }

        #status-bar { position: absolute; top: 0; left: 0; width: 100%; display: flex; justify-content: center; padding-top: 10px; z-index: 50; pointer-events: none; }
        .badge { background: rgba(0,0,0,0.7); color: #888; border: 1px solid #444; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; display: flex; align-items: center; gap: 8px; backdrop-filter: blur(4px); }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #555; }
        .badge.live { color: #fff; border-color: #f00; background: rgba(200,0,0,0.6); }
        .badge.live .dot { background: #f00; box-shadow: 0 0 8px #f00; animation: pulse 1s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

        #setup { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 300; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; color: white; overflow-y: auto; padding: 20px; padding-top: 50px; }
        #setup.hidden { display: none; }
        #setup h2 { margin: 0 0 5px 0; font-size: 24px; }
        #setup .subtitle { color: #666; font-size: 12px; margin-bottom: 20px; }

        .form-group { width: 100%; max-width: 320px; margin-bottom: 15px; }
        .form-group label { display: block; color: #888; font-size: 11px; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
        .form-group input, .form-group select { width: 100%; padding: 12px; font-size: 16px; border-radius: 8px; border: 1px solid #333; background: #1a1a1a; color: #fff; }
        .form-group input::placeholder { color: #555; }
        .form-group select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; }

        .form-row { display: flex; gap: 10px; width: 100%; max-width: 320px; }
        .form-row .form-group { flex: 1; margin-bottom: 15px; }

        .section-title { color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin: 20px 0 10px 0; width: 100%; max-width: 320px; border-top: 1px solid #333; padding-top: 20px; }

        button.start-btn { margin-top: 25px; padding: 16px 50px; font-size: 18px; background: #00cc00; color: #000; border: none; font-weight: bold; border-radius: 30px; cursor: pointer; }
        button.start-btn:active { background: #00aa00; }

        #controls { position: absolute; bottom: 25px; width: 100%; display: flex; justify-content: center; gap: 12px; z-index: 200; pointer-events: none; flex-wrap: wrap; padding: 0 10px; }
        .ctrl { pointer-events: auto; background: rgba(0,0,0,0.7); color: white; padding: 10px 16px; border-radius: 20px; border: 1px solid #444; font-size: 12px; text-transform: uppercase; font-weight: 600; cursor: pointer; backdrop-filter: blur(4px); }
        .ctrl:active { background: rgba(50,50,50,0.8); }
        .ctrl.active { border-color: #00cc00; color: #00cc00; }
    </style>
</head>
<body>
    <video autoplay playsinline muted></video>
    <div id="status-bar"><div class="badge" id="live-badge"><div class="dot"></div> <span id="status-text">READY</span></div></div>

    <div id="setup">
        <h2>Mirror Stream</h2>
        <p class="subtitle">Stream to Chaturbate with mirrored camera</p>

        <div class="form-group">
            <label>RTMP URL</label>
            <input type="text" id="rtmpUrl" placeholder="rtmp://global.live.mmcdn.com/live-origin/">
        </div>

        <div class="form-group">
            <label>Broadcast Token</label>
            <input type="text" id="streamKey" placeholder="Your stream key">
        </div>

        <div class="section-title">Video Settings</div>

        <div class="form-row">
            <div class="form-group">
                <label>Orientation</label>
                <select id="orientation">
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                </select>
            </div>
            <div class="form-group">
                <label>Rotation</label>
                <select id="rotateAngle">
                    <option value="0">0°</option>
                    <option value="90">90°</option>
                    <option value="180">180°</option>
                    <option value="270">270°</option>
                </select>
            </div>
        </div>

        <div class="form-group">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" id="mirrorOutput" checked style="width: auto;">
                <span style="text-transform: none; font-size: 14px; color: #ccc;">Mirror output stream</span>
            </label>
        </div>

        <div class="form-group">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" id="beautyFilter" style="width: auto;">
                <span style="text-transform: none; font-size: 14px; color: #ccc;">Beauty filter</span>
            </label>
        </div>

        <button class="start-btn" onclick="startApp()">GO LIVE</button>
    </div>

    <div id="controls">
        <button class="ctrl" id="mirrorBtn" onclick="toggleMirror()">Mirror</button>
        <button class="ctrl" onclick="toggleSettings()">Settings</button>
        <button class="ctrl" onclick="stopStream()">Stop</button>
    </div>

    <script>
        const socket = io({ transports: ["websocket"], reconnection: true });
        let mediaRecorder;
        let isFromApp = false;
        let isStreaming = false;

        // Parse URL params (from iOS app)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('orientation') || urlParams.has('mirror') || urlParams.has('beauty')) {
            isFromApp = true;
            document.getElementById('orientation').value = urlParams.get('orientation') || 'portrait';
            document.getElementById('rotateAngle').value = urlParams.get('rotateAngle') || '0';
            document.getElementById('mirrorOutput').checked = urlParams.get('mirror') === '1';
            document.getElementById('beautyFilter').checked = urlParams.get('beauty') === '1';
            console.log('Loaded from iOS app');
        }

        socket.on('error', (msg) => {
            console.error('Server error:', msg);
            document.getElementById('status-text').innerText = 'ERROR';
            document.getElementById('live-badge').classList.remove('live');
        });
        socket.on('streaming', () => {
            document.getElementById('status-text').innerText = 'LIVE';
            document.getElementById('live-badge').classList.add('live');
        });
        socket.on('disconnect', () => {
            document.getElementById('status-text').innerText = 'DISCONNECTED';
            document.getElementById('live-badge').classList.remove('live');
        });

        let camPromise;

        window.onload = () => {
            // Load saved data
            if(localStorage.getItem('rtmpUrl')) document.getElementById('rtmpUrl').value = localStorage.getItem('rtmpUrl');
            if(localStorage.getItem('streamKey')) document.getElementById('streamKey').value = localStorage.getItem('streamKey');
            if(localStorage.getItem('orientation')) document.getElementById('orientation').value = localStorage.getItem('orientation');
            if(localStorage.getItem('rotateAngle')) document.getElementById('rotateAngle').value = localStorage.getItem('rotateAngle');
            if(localStorage.getItem('mirrorOutput') !== null) document.getElementById('mirrorOutput').checked = localStorage.getItem('mirrorOutput') === 'true';
            if(localStorage.getItem('beautyFilter') !== null) document.getElementById('beautyFilter').checked = localStorage.getItem('beautyFilter') === 'true';

            initCam();

            // If loaded from iOS app with saved credentials, auto-start
            if (isFromApp && localStorage.getItem('rtmpUrl') && localStorage.getItem('streamKey')) {
                setTimeout(() => startApp(true), 500);
            }

            // Hide web controls when embedded in iOS app
            if (isFromApp) {
                document.getElementById('controls').style.display = 'none';
            }
        };

        function initCam() {
            if (camPromise) return camPromise;
            camPromise = (async () => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: 30 },
                        audio: true
                    });
                    document.querySelector('video').srcObject = stream;
                    window.localStream = stream;
                    return stream;
                } catch(e) {
                    document.getElementById('status-text').innerText = 'CAM ERROR';
                    console.error("Camera Error:", e.message);
                    throw e;
                }
            })();
            return camPromise;
        }

        function startApp(autoStart = false) {
            let rtmpUrl = document.getElementById('rtmpUrl').value.trim();
            const key = document.getElementById('streamKey').value.trim();

            if (!rtmpUrl || !key) {
                if (!autoStart) alert('Enter RTMP URL and stream key');
                return;
            }

            // Save settings
            localStorage.setItem('rtmpUrl', rtmpUrl);
            localStorage.setItem('streamKey', key);
            localStorage.setItem('orientation', document.getElementById('orientation').value);
            localStorage.setItem('rotateAngle', document.getElementById('rotateAngle').value);
            localStorage.setItem('mirrorOutput', document.getElementById('mirrorOutput').checked);
            localStorage.setItem('beautyFilter', document.getElementById('beautyFilter').checked);

            // Fix URL format
            if (!rtmpUrl.toLowerCase().startsWith('rtmp://')) rtmpUrl = 'rtmp://' + rtmpUrl;
            if (!rtmpUrl.endsWith('/')) rtmpUrl += '/';

            document.getElementById('setup').classList.add('hidden');
            const start = () => startBroadcasting(rtmpUrl, key);
            if (!window.localStream) {
                document.getElementById('status-text').innerText = 'CAM STARTING...';
                initCam().then(start).catch(() => {
                    document.getElementById('status-text').innerText = 'CAM ERROR';
                });
                return;
            }
            start();
        }

        function startBroadcasting(url, key) {
            const statusText = document.getElementById('status-text');
            const badge = document.getElementById('live-badge');
            statusText.innerText = 'CONNECTING...';

            const rotationConfig = {
                orientation: document.getElementById('orientation').value,
                angle: document.getElementById('rotateAngle').value,
                mirror: document.getElementById('mirrorOutput').checked,
                beauty: document.getElementById('beautyFilter').checked
            };

            const mime = ["video/mp4", "video/webm;codecs=h264", "video/webm"].find(t => MediaRecorder.isTypeSupported(t)) || "";
            try {
                if (!window.localStream) {
                    throw new Error('Camera stream not ready');
                }
                if (mime) {
                    try {
                        mediaRecorder = new MediaRecorder(window.localStream, { mimeType: mime });
                    } catch (e) {
                        console.warn('MediaRecorder failed with mime type, retrying without mime:', e.message);
                        mediaRecorder = new MediaRecorder(window.localStream);
                    }
                } else {
                    mediaRecorder = new MediaRecorder(window.localStream);
                }
            } catch (e) {
                statusText.innerText = 'RECORDER ERROR';
                console.error('Recorder Error:', e.message);
                alert('Recorder error: ' + e.message);
                return;
            }

            socket.emit('config', {
                target: url + key,
                format: mime,
                rotation: rotationConfig
            }, (response) => {
                if (!response || !response.ok) {
                    statusText.innerText = 'SERVER ERROR';
                    return;
                }
                mediaRecorder.start(250);
                isStreaming = true;
                badge.classList.add('live');
                statusText.innerText = 'LIVE';
            });

            mediaRecorder.ondataavailable = async (e) => {
                if (e.data.size > 0) socket.emit('binarystream', await e.data.arrayBuffer());
            };
        }

        function toggleMirror() {
            const v = document.querySelector('video');
            const btn = document.getElementById('mirrorBtn');
            if (v.style.transform === 'scaleX(1)') {
                v.style.transform = 'scaleX(-1)';
                btn.classList.add('active');
            } else {
                v.style.transform = 'scaleX(1)';
                btn.classList.remove('active');
            }
        }

        function toggleSettings() {
            const setup = document.getElementById('setup');
            setup.classList.toggle('hidden');
        }

        function stopStream() {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
            isStreaming = false;
            document.getElementById('status-text').innerText = 'STOPPED';
            document.getElementById('live-badge').classList.remove('live');
            document.getElementById('setup').classList.remove('hidden');
        }
    </script>
</body>
</html>
`;

// --- BACKEND ---
app.get('/', (req, res) => res.send(html));

io.on('connection', (socket) => {
    let ffmpeg;
    let isReady = false;
    let dataReceived = 0;

    console.log('Client connected:', socket.id);

    socket.on('config', (data, ack) => {
        if (ffmpeg) {
            console.log('Killing previous FFmpeg');
            ffmpeg.kill();
        }
        console.log('=== NEW STREAM ===');
        console.log('Target:', data.target);
        console.log('Format:', data.format);
        console.log('Rotation config:', data.rotation);

        // Build video filter based on rotation config
        let vf = [];
        const rot = data.rotation || {};
        const angle = rot.angle || '0';
        const mirror = rot.mirror || false;
        const beauty = rot.beauty || false;

        // Apply rotation based on angle
        if (angle === '90') {
            vf.push('transpose=1');
        } else if (angle === '180') {
            vf.push('transpose=1,transpose=1');
        } else if (angle === '270') {
            vf.push('transpose=2');
        }

        // Apply mirror if enabled
        if (mirror) {
            vf.push('hflip');
        }

        if (beauty) {
            vf.push('hqdn3d=1.5:1.5:6:6');
            vf.push('eq=contrast=1.03:brightness=0.02:saturation=1.08');
        }

        const filterArgs = vf.length ? ['-vf', vf.join(',')] : [];

        const args = [
            '-loglevel', 'warning',
            '-fflags', '+genpts+discardcorrupt',
            '-use_wallclock_as_timestamps', '1',
            '-i', '-',
            ...filterArgs,
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-tune', 'zerolatency',
            '-pix_fmt', 'yuv420p',
            '-g', '60',
            '-keyint_min', '60',
            '-b:v', '2500k',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-ar', '44100',
            '-ac', '1',
            '-metadata:s:v:0', 'rotate=0',
            '-f', 'flv',
            data.target
        ];
        console.log('Using filters:', vf.join(','));

        try {
            ffmpeg = spawn(ffmpegPath, args);

            ffmpeg.stderr.on('data', (d) => {
                const msg = d.toString();
                console.log(msg);
                if (msg.includes('Connection refused') || msg.includes('Failed to connect')) {
                    socket.emit('error', 'RTMP connection failed');
                }
                if (msg.includes('frame=')) {
                    socket.emit('streaming', true);
                }
            });

            ffmpeg.on('close', (code, signal) => {
                console.log('FFmpeg closed - code:', code, 'signal:', signal);
                isReady = false;
                socket.emit('error', 'Stream ended');
            });

            ffmpeg.on('error', (e) => {
                console.log('FFmpeg error:', e.message);
                socket.emit('error', 'FFmpeg error');
            });

            ffmpeg.stdin.on('error', () => {});

            isReady = true;
            if (ack) ack({ ok: true });

        } catch (e) {
            console.error("Spawn Error:", e);
            if(ack) ack({ ok: false });
        }
    });

    socket.on('binarystream', (data) => {
        if (isReady && ffmpeg && ffmpeg.stdin.writable) {
            dataReceived += data.byteLength;
            ffmpeg.stdin.write(Buffer.from(data));
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('Client disconnected:', reason, '- received:', dataReceived, 'bytes');
        if (ffmpeg) ffmpeg.kill();
    });
});

server.listen(port, () => console.log('Mirror Stream running on port ' + port));
