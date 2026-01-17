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
    <title>Stream Relay Auto-Save</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        body { margin: 0; background: #000; overflow: hidden; height: 100vh; width: 100vw; font-family: sans-serif; }
        video { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
        #status-bar { position: absolute; top: 0; left: 0; width: 100%; display: flex; justify-content: center; padding-top: 5px; z-index: 50; pointer-events: none; }
        .badge { background: rgba(0,0,0,0.6); color: #888; border: 1px solid #444; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; display: flex; align-items: center; gap: 8px; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #555; }
        .badge.live { color: #fff; border-color: #f00; background: rgba(200,0,0,0.5); }
        .badge.live .dot { background: #f00; box-shadow: 0 0 8px #f00; }
        .overlay-box { position: absolute; background: #222; border: 1px solid #444; z-index: 100; overflow: hidden; display: none; flex-direction: column; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
        .drag-handle { width: 100%; height: 28px; background: rgba(0,0,0,0.85); cursor: move; display: flex; align-items: center; justify-content: space-between; padding: 0 5px; box-sizing: border-box; }
        .handle-title { color: #aaa; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
        .win-ctrls { display: flex; gap: 5px; }
        .win-btn { width: 12px; height: 12px; border-radius: 50%; border: none; cursor: pointer; }
        .btn-min { background: #fc0; }
        .btn-max { background: #0f0; }
        .btn-close { background: #f00; }
        iframe { flex-grow: 1; border: none; width: 100%; background: #000; }
        
        #setup { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.92); z-index: 300; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; }
        input { padding: 12px; margin: 8px; font-size: 16px; width: 80%; max-width: 300px; border-radius: 5px; border: none; }
        label { color: #aaa; font-size: 12px; margin-top: 15px; }
        button.start-btn { margin-top: 20px; padding: 15px 40px; font-size: 18px; background: #0f0; border: none; font-weight: bold; border-radius: 5px; }
        
        #controls { position: absolute; bottom: 20px; width: 100%; display: flex; justify-content: center; gap: 10px; z-index: 200; pointer-events: none; }
        .ctrl { pointer-events: auto; background: rgba(0,0,0,0.6); color: white; padding: 8px 12px; border-radius: 15px; border: 1px solid #666; font-size: 12px; text-transform: uppercase; }

        /* Default Sizes */
        #watch-box { top: 60px; right: 10px; width: 45vw; height: 30vh; }
        #chat-box { bottom: 90px; left: 10px; width: 45vw; height: 40vh; border: 1px solid #0f0; }
    </style>
</head>
<body>
    <video autoplay playsinline muted></video>
    <div id="status-bar"><div class="badge" id="live-badge"><div class="dot"></div> <span id="status-text">READY</span></div></div>

    <div id="setup">
        <h2>Easy Setup</h2>
        <label>RTMP URL (Paste once, I'll remember)</label>
        <input id="rtmpUrl" placeholder="global.live.mmcdn...">
        
        <label>BROADCAST TOKEN (Key)</label>
        <input id="streamKey" placeholder="Paste Token Here">
        
        <label>YOUR USERNAME</label>
        <input id="myUser" placeholder="richsteve17">
        
        <label>MONITOR USERNAME</label>
        <input id="watchUser" placeholder="Other model">
        
        <button class="start-btn" onclick="startApp()">GO LIVE</button>
    </div>

    <div id="watch-box" class="overlay-box"><div class="drag-handle" data-target="watch-box"><span class="handle-title">Monitor</span><div class="win-ctrls"><button class="win-btn btn-min" onclick="resizeBox('watch-box', 'small')"></button><button class="win-btn btn-max" onclick="resizeBox('watch-box', 'large')"></button><button class="win-btn btn-close" onclick="closeBox('watch-box')"></button></div></div><iframe id="watch-frame" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="no-referrer"></iframe></div>
    <div id="chat-box" class="overlay-box"><div class="drag-handle" data-target="chat-box"><span class="handle-title">My Chat</span><div class="win-ctrls"><button class="win-btn btn-min" onclick="resizeBox('chat-box', 'small')"></button><button class="win-btn btn-max" onclick="resizeBox('chat-box', 'large')"></button></div></div><iframe id="chat-frame" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" referrerpolicy="no-referrer"></iframe></div>
    <div id="controls"><button class="ctrl" onclick="toggleCam()">Flip Cam</button><button class="ctrl" onclick="toggleOpacity()">Ghost Mode</button><button class="ctrl" onclick="location.reload()">Reset</button></div>

    <script>
        const socket = io({ transports: ["websocket"], reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 1000 });
        let mediaRecorder;

        // --- SOCKET ERROR HANDLING ---
        socket.on('error', (msg) => {
            console.error('Server error:', msg);
            document.getElementById('status-text').innerText = 'ERROR: ' + msg;
            document.getElementById('live-badge').classList.remove('live');
            document.getElementById('live-badge').style.borderColor = '#f80';
        });
        socket.on('streaming', () => {
            document.getElementById('status-text').innerText = 'STREAMING';
        });
        socket.on('disconnect', (reason) => {
            console.log('Disconnected:', reason);
            document.getElementById('status-text').innerText = 'DISCONNECTED';
            document.getElementById('live-badge').classList.remove('live');
        });
        socket.on('reconnect', () => {
            console.log('Reconnected');
            document.getElementById('status-text').innerText = 'RECONNECTED';
        });

        // --- AUTO-LOAD SAVED DATA ---
        window.onload = () => {
            if(localStorage.getItem('rtmpUrl')) document.getElementById('rtmpUrl').value = localStorage.getItem('rtmpUrl');
            if(localStorage.getItem('streamKey')) document.getElementById('streamKey').value = localStorage.getItem('streamKey');
            if(localStorage.getItem('myUser')) document.getElementById('myUser').value = localStorage.getItem('myUser');
            if(localStorage.getItem('watchUser')) document.getElementById('watchUser').value = localStorage.getItem('watchUser');
            initCam();
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
            } catch(e) { alert("Camera Error: " + e.message); }
        }

        function startApp() {
            let rtmpUrl = document.getElementById('rtmpUrl').value.trim();
            const key = document.getElementById('streamKey').value.trim();
            const myUser = document.getElementById('myUser').value.trim();
            const watchUser = document.getElementById('watchUser').value.trim();

            // --- AUTO-SAVE DATA ---
            localStorage.setItem('rtmpUrl', rtmpUrl);
            localStorage.setItem('streamKey', key);
            localStorage.setItem('myUser', myUser);
            localStorage.setItem('watchUser', watchUser);

            // --- SMART URL FIXER ---
            if (!rtmpUrl.toLowerCase().startsWith('rtmp://')) rtmpUrl = 'rtmp://' + rtmpUrl;
            if (rtmpUrl.startsWith('RTMP://') || rtmpUrl.startsWith('Rtmp://')) rtmpUrl = 'rtmp://' + rtmpUrl.substring(7);
            if (!rtmpUrl.endsWith('/')) rtmpUrl += '/';

            if (watchUser) {
                // Chaturbate official embed - use the affiliate embed format
                document.getElementById('watch-frame').src = 'https://chaturbate.com/in/?tour=dT8X&campaign=8sKXp&room=' + watchUser;
                document.getElementById('watch-box').style.display = 'flex';
            }
            if (myUser) {
                // Chat - use fullvideo which sometimes allows embedding
                document.getElementById('chat-frame').src = 'https://chaturbate.com/fullvideo/?b=' + myUser;
                document.getElementById('chat-box').style.display = 'flex';
            }
            
            document.getElementById('setup').style.display = 'none';
            if (key && rtmpUrl) startBroadcasting(rtmpUrl, key);
        }

        function startBroadcasting(url, key) {
            const statusText = document.getElementById('status-text');
            const badge = document.getElementById('live-badge');
            statusText.innerText = "INITIALIZING...";

            let mime = pickMimeType();
            try {
                mediaRecorder = mime ? new MediaRecorder(window.localStream, { mimeType: mime }) : new MediaRecorder(window.localStream);
            } catch (e) { alert("Recorder Error: " + e.message); return; }

            socket.emit('config', { target: url + key, format: mime }, (response) => {
                if (!response || !response.ok) { alert("Server Error"); return; }
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

        function toggleCam() { const v = document.querySelector('video'); v.style.transform = v.style.transform === 'scaleX(1)' ? 'scaleX(-1)' : 'scaleX(1)'; }
        function resizeBox(id, size) { const el = document.getElementById(id); if(size === 'small') { el.style.width = '150px'; el.style.height = '120px'; } if(size === 'large') { el.style.width = '90vw'; el.style.height = '60vh'; } }
        function closeBox(id) { document.getElementById(id).style.display = 'none'; }
        let ghost = false;
        function toggleOpacity() { ghost = !ghost; document.querySelectorAll('.overlay-box').forEach(el => el.style.opacity = ghost ? '0.3' : '1'); }
        document.querySelectorAll('.drag-handle').forEach(handle => { handle.addEventListener('touchmove', (e) => { e.preventDefault(); const box = document.getElementById(handle.dataset.target); const t = e.targetTouches[0]; box.style.left = (t.pageX - 50) + 'px'; box.style.top = (t.pageY - 10) + 'px'; }); });
    </script>
</body>
</html>
`;

app.get('/', (req, res) => res.send(html));

io.on('connection', (socket) => {
    let ffmpeg;
    let isReady = false;
    let dataReceived = 0;
    let lastDataTime = Date.now();

    console.log('Client connected:', socket.id);

    socket.on('config', (data, ack) => {
        if (ffmpeg) {
            console.log('Killing previous FFmpeg');
            ffmpeg.kill();
        }
        console.log('=== NEW STREAM ===');
        console.log('Target:', data.target);
        console.log('Format:', data.format);

        const args = [
            '-loglevel', 'verbose',
            '-fflags', '+genpts+discardcorrupt',
            '-i', '-',
            '-c:v', 'copy',
            '-c:a', 'copy',
            '-f', 'flv',
            data.target
        ];

        try {
            ffmpeg = spawn(ffmpegPath, args);

            ffmpeg.stderr.on('data', (d) => {
                const msg = d.toString();
                console.log(msg);
                // Notify client of RTMP errors
                if (msg.includes('Connection refused') || msg.includes('Failed to connect')) {
                    socket.emit('error', 'RTMP connection failed - check your stream key');
                }
                if (msg.includes('frame=')) {
                    // Stream is actually working
                    socket.emit('streaming', true);
                }
            });

            ffmpeg.on('close', (code, signal) => {
                console.log('FFmpeg closed - code:', code, 'signal:', signal);
                console.log('Total data received:', dataReceived, 'bytes');
                isReady = false;
                socket.emit('error', 'Stream ended - FFmpeg exited');
            });

            ffmpeg.on('error', (e) => {
                console.log('FFmpeg error:', e.message);
                socket.emit('error', 'FFmpeg error: ' + e.message);
            });

            ffmpeg.stdin.on('error', (e) => {
                console.log('stdin error:', e.message);
            });

            isReady = true;
            if (ack) ack({ ok: true });

        } catch (e) {
            console.error("Spawn Error:", e);
            if(ack) ack({ ok: false, error: e.message });
        }
    });

    socket.on('binarystream', (data) => {
        if (isReady && ffmpeg && ffmpeg.stdin.writable) {
            dataReceived += data.byteLength;
            lastDataTime = Date.now();
            ffmpeg.stdin.write(Buffer.from(data));
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('Client disconnected:', reason);
        console.log('Total data received before disconnect:', dataReceived, 'bytes');
        if (ffmpeg) ffmpeg.kill();
    });
});

server.listen(port, () => console.log('Relay Auto-Save running on ' + port));
