import express from 'express';
import { Server } from 'socket.io';
import { spawn, execSync } from 'child_process';
import http from 'http';

// Detect ffmpeg - prefer system over ffmpeg-static (which crashes on Render)
let ffmpegPath = 'ffmpeg';
try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    console.log('Using system ffmpeg');
} catch {
    try {
        const { default: ffmpegStatic } = await import('ffmpeg-static');
        ffmpegPath = ffmpegStatic;
        console.log('Using ffmpeg-static:', ffmpegPath);
    } catch {
        console.log('No ffmpeg found, will try system ffmpeg');
    }
}

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    transports: ["websocket"],
    maxHttpBufferSize: 1e8,
    pingTimeout: 60000
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
        body { margin: 0; background: #000; overflow: hidden; height: 100vh; width: 100vw; font-family: sans-serif; }
        video { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
        #status-bar { position: absolute; top: 0; left: 0; width: 100%; display: flex; justify-content: center; padding-top: 5px; z-index: 50; pointer-events: none; }
        .badge { background: rgba(0,0,0,0.6); color: #888; border: 1px solid #444; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; display: flex; align-items: center; gap: 8px; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #555; }
        .badge.live { color: #fff; border-color: #f00; background: rgba(200,0,0,0.5); }
        .badge.live .dot { background: #f00; box-shadow: 0 0 8px #f00; }

        #setup { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 300; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; overflow-y: auto; }
        #setup.hidden { display: none; }
        input[type="text"] { padding: 12px; margin: 8px; font-size: 16px; width: 80%; max-width: 300px; border-radius: 5px; border: none; }
        label { color: #aaa; font-size: 12px; margin-top: 15px; }
        button.start-btn { margin-top: 20px; padding: 15px 40px; font-size: 18px; background: #0f0; border: none; font-weight: bold; border-radius: 5px; }

        #controls { position: absolute; bottom: 20px; width: 100%; display: flex; justify-content: center; gap: 10px; z-index: 200; pointer-events: none; }
        .ctrl { pointer-events: auto; background: rgba(0,0,0,0.6); color: white; padding: 8px 12px; border-radius: 15px; border: 1px solid #666; font-size: 12px; text-transform: uppercase; }
    </style>
</head>
<body>
    <video autoplay playsinline muted></video>
    <div id="status-bar"><div class="badge" id="live-badge"><div class="dot"></div> <span id="status-text">READY</span></div></div>

    <div id="setup">
        <h2>Mirror Stream</h2>
        <label>RTMP URL</label>
        <input type="text" id="rtmpUrl" placeholder="rtmp://global.live.mmcdn.com/live-origin/">

        <label>BROADCAST TOKEN</label>
        <input type="text" id="streamKey" placeholder="Your stream key">

        <button class="start-btn" onclick="startApp()">GO LIVE</button>
    </div>

    <div id="controls">
        <button class="ctrl" onclick="toggleMirror()">Mirror</button>
        <button class="ctrl" onclick="location.reload()">Reset</button>
    </div>

    <script>
        const socket = io({ transports: ["websocket"], reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 1000 });
        let mediaRecorder;
        let isFromApp = false;
        let rotationConfig = { orientation: 'portrait', rotate: 'cw', angle: '0', mirror: false };

        // Parse URL params (from iOS app)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('orientation')) {
            isFromApp = true;
            rotationConfig.orientation = urlParams.get('orientation') || 'portrait';
            rotationConfig.rotate = urlParams.get('rotate') || 'cw';
            rotationConfig.angle = urlParams.get('rotateAngle') || '0';
            rotationConfig.mirror = urlParams.get('mirror') === '1';
            console.log('iOS app config:', rotationConfig);
        }

        socket.on('error', (msg) => {
            console.error('Server error:', msg);
            document.getElementById('status-text').innerText = 'ERROR';
        });
        socket.on('streaming', () => {
            document.getElementById('status-text').innerText = 'LIVE (ON AIR)';
        });
        socket.on('disconnect', (reason) => {
            console.log('Disconnected:', reason);
            document.getElementById('status-text').innerText = 'DISCONNECTED';
            document.getElementById('live-badge').classList.remove('live');
        });

        window.onload = () => {
            // Load saved data
            if(localStorage.getItem('rtmpUrl')) document.getElementById('rtmpUrl').value = localStorage.getItem('rtmpUrl');
            if(localStorage.getItem('streamKey')) document.getElementById('streamKey').value = localStorage.getItem('streamKey');

            initCam();

            // If loaded from iOS app with saved credentials, auto-start
            if (isFromApp && localStorage.getItem('rtmpUrl') && localStorage.getItem('streamKey')) {
                setTimeout(() => startApp(), 500);
            }
        };

        function pickMimeType() {
            const candidates = ["video/mp4", "video/webm;codecs=h264", "video/webm"];
            return candidates.find(t => MediaRecorder.isTypeSupported(t)) || "";
        }

        async function initCam() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: 30 },
                    audio: true
                });
                document.querySelector('video').srcObject = stream;
                window.localStream = stream;
            } catch(e) {
                document.getElementById('status-text').innerText = 'CAM ERROR';
                console.error("Camera Error:", e.message);
            }
        }

        function startApp() {
            let rtmpUrl = document.getElementById('rtmpUrl').value.trim();
            const key = document.getElementById('streamKey').value.trim();

            if (!rtmpUrl || !key) {
                alert('Enter RTMP URL and stream key');
                return;
            }

            // Save
            localStorage.setItem('rtmpUrl', rtmpUrl);
            localStorage.setItem('streamKey', key);

            // Fix URL format
            if (!rtmpUrl.toLowerCase().startsWith('rtmp://')) rtmpUrl = 'rtmp://' + rtmpUrl;
            if (!rtmpUrl.endsWith('/')) rtmpUrl += '/';

            document.getElementById('setup').classList.add('hidden');
            startBroadcasting(rtmpUrl, key);
        }

        function startBroadcasting(url, key) {
            const statusText = document.getElementById('status-text');
            const badge = document.getElementById('live-badge');
            statusText.innerText = "CONNECTING...";

            let mime = pickMimeType();
            try {
                mediaRecorder = mime ? new MediaRecorder(window.localStream, { mimeType: mime }) : new MediaRecorder(window.localStream);
            } catch (e) {
                statusText.innerText = "RECORDER ERROR";
                return;
            }

            // Send config with rotation settings
            socket.emit('config', {
                target: url + key,
                format: mime,
                rotation: rotationConfig
            }, (response) => {
                if (!response || !response.ok) {
                    statusText.innerText = "SERVER ERROR";
                    return;
                }
                mediaRecorder.start(250);
                badge.classList.add('live');
                statusText.innerText = "LIVE (ON AIR)";
            });

            mediaRecorder.ondataavailable = async (e) => {
                if (e.data.size > 0) {
                    const buffer = await e.data.arrayBuffer();
                    socket.emit('binarystream', buffer);
                }
            };
        }

        function toggleMirror() {
            const v = document.querySelector('video');
            v.style.transform = v.style.transform === 'scaleX(1)' ? 'scaleX(-1)' : 'scaleX(1)';
        }
    </script>
</body>
</html>
`;

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
        const direction = rot.rotate || 'cw';
        const orientation = rot.orientation || 'portrait';
        const mirror = rot.mirror || false;

        // Apply rotation based on angle
        if (angle === '90') {
            vf.push(direction === 'cw' ? 'transpose=1' : 'transpose=2');
        } else if (angle === '180') {
            vf.push('transpose=1,transpose=1');
        } else if (angle === '270') {
            vf.push(direction === 'cw' ? 'transpose=2' : 'transpose=1');
        }

        // Apply mirror if enabled
        if (mirror) {
            vf.push('hflip');
        }

        // Build FFmpeg args
        let args;
        if (vf.length > 0) {
            // Need encoding for filters
            args = [
                '-loglevel', 'warning',
                '-fflags', '+genpts+discardcorrupt',
                '-i', '-',
                '-vf', vf.join(','),
                '-c:v', 'libx264',
                '-preset', 'ultrafast',
                '-tune', 'zerolatency',
                '-b:v', '2500k',
                '-c:a', 'aac',
                '-b:a', '128k',
                '-f', 'flv',
                data.target
            ];
            console.log('Using filters:', vf.join(','));
        } else {
            // No filters, just copy
            args = [
                '-loglevel', 'warning',
                '-fflags', '+genpts+discardcorrupt',
                '-i', '-',
                '-c:v', 'copy',
                '-c:a', 'copy',
                '-f', 'flv',
                data.target
            ];
            console.log('No filters, using copy');
        }

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
