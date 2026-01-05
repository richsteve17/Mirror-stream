import express from 'express';
import { Server } from 'socket.io';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import http from 'http';

const app = express();
const server = http.createServer(app);

// 1. FORCE WEBSOCKETS
const io = new Server(server, {
    transports: ["websocket"], 
    maxHttpBufferSize: 1e8, 
    pingTimeout: 60000
});

const port = process.env.PORT || 3000;

// --- FRONTEND ---
const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Stream Relay Pro</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        body { margin: 0; background: #000; overflow: hidden; height: 100vh; width: 100vw; font-family: sans-serif; }
        
        /* VIDEO LAYER */
        video { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }

        /* STATUS BAR */
        #status-bar { position: absolute; top: 0; left: 0; width: 100%; display: flex; justify-content: center; padding-top: 5px; z-index: 50; pointer-events: none; }
        .badge { background: rgba(0,0,0,0.6); color: #888; border: 1px solid #444; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; display: flex; align-items: center; gap: 8px; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #555; }
        .badge.live { color: #fff; border-color: #f00; background: rgba(200,0,0,0.5); }
        .badge.live .dot { background: #f00; box-shadow: 0 0 8px #f00; }

        /* OVERLAYS */
        .overlay-box { position: absolute; background: #222; border: 1px solid #444; z-index: 100; overflow: hidden; display: none; flex-direction: column; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
        .drag-handle { width: 100%; height: 28px; background: rgba(0,0,0,0.85); cursor: move; display: flex; align-items: center; justify-content: space-between; padding: 0 5px; box-sizing: border-box; }
        .handle-title { color: #aaa; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
        .win-ctrls { display: flex; gap: 5px; }
        .win-btn { width: 12px; height: 12px; border-radius: 50%; border: none; cursor: pointer; }
        .btn-min { background: #fc0; }
        .btn-max { background: #0f0; }
        .btn-close { background: #f00; }
        iframe { flex-grow: 1; border: none; width: 100%; background: #000; }
        
        #watch-box { top: 60px; right: 10px; width: 45vw; height: 30vh; }
        #chat-box { bottom: 90px; left: 10px; width: 45vw; height: 40vh; border: 1px solid #0f0; }
        
        #setup { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.92); z-index: 300; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; }
        input { padding: 12px; margin: 8px; font-size: 16px; width: 80%; max-width: 300px; border-radius: 5px; border: none; }
        label { color: #aaa; font-size: 12px; margin-top: 15px; }
        button.start-btn { margin-top: 20px; padding: 15px 40px; font-size: 18px; background: #0f0; border: none; font-weight: bold; border-radius: 5px; }
        
        #controls { position: absolute; bottom: 20px; width: 100%; display: flex; justify-content: center; gap: 10px; z-index: 200; pointer-events: none; }
        .ctrl { pointer-events: auto; background: rgba(0,0,0,0.6); color: white; padding: 8px 12px; border-radius: 15px; border: 1px solid #666; font-size: 12px; text-transform: uppercase; }
        .ctrl:active { background: #fff; color: #000; }
    </style>
</head>
<body>
    <video autoplay playsinline muted></video>
    <div id="status-bar"><div class="badge" id="live-badge"><div class="dot"></div> <span id="status-text">READY</span></div></div>

    <div id="setup">
        <h2>Stream Setup</h2>
        <label>STREAM KEY</label><input id="streamKey" placeholder="Paste Key Here">
        <label>CHAT USERNAME</label><input id="myUser" placeholder="Your Username">
        <label>WATCH USERNAME</label><input id="watchUser" placeholder="Other Performer">
        <button class="start-btn" onclick="startApp()">GO LIVE</button>
    </div>

    <div id="watch-box" class="overlay-box">
        <div class="drag-handle" data-target="watch-box">
            <span class="handle-title">Monitor</span>
            <div class="win-ctrls">
                <button class="win-btn btn-min" onclick="resizeBox('watch-box', 'small')"></button>
                <button class="win-btn btn-max" onclick="resizeBox('watch-box', 'large')"></button>
                <button class="win-btn btn-close" onclick="closeBox('watch-box')"></button>
            </div>
        </div>
        <iframe id="watch-frame"></iframe>
    </div>

    <div id="chat-box" class="overlay-box">
        <div class="drag-handle" data-target="chat-box">
            <span class="handle-title">My Chat</span>
            <div class="win-ctrls">
                <button class="win-btn btn-min" onclick="resizeBox('chat-box', 'small')"></button>
                <button class="win-btn btn-max" onclick="resizeBox('chat-box', 'large')"></button>
            </div>
        </div>
        <iframe id="chat-frame"></iframe>
    </div>

    <div id="controls">
        <button class="ctrl" onclick="toggleCam()">Flip Cam</button>
        <button class="ctrl" onclick="toggleOpacity()">Ghost Mode</button>
        <button class="ctrl" onclick="location.reload()">Reset</button>
    </div>

    <script>
        const socket = io({ transports: ["websocket"] });
        let mediaRecorder;
        
        function pickMimeType() {
            const candidates = [
                "video/mp4",
                'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
                "video/webm;codecs=h264",
                "video/webm;codecs=vp8,opus",
                "video/webm"
            ];
            return candidates.find(t => MediaRecorder.isTypeSupported(t)) || "";
        }

        async function initCam() {
            try {
                // Request Landscape Resolution
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: 30 }, 
                    audio: true 
                });
                document.querySelector('video').srcObject = stream;
                window.localStream = stream;
            } catch(e) { alert("Camera Error: " + e.message); }
        }
        initCam();

        function startApp() {
            // TRIM SPACES - Critical Fix
            const key = document.getElementById('streamKey').value.trim();
            const myUser = document.getElementById('myUser').value.trim();
            const watchUser = document.getElementById('watchUser').value.trim();

            if (watchUser) {
                document.getElementById('watch-frame').src = 'https://chaturbate.com/embed/' + watchUser + '?bgcolor=black';
                document.getElementById('watch-box').style.display = 'flex';
            }
            if (myUser) {
                document.getElementById('chat-frame').src = 'https://chaturbate.com/popout/' + myUser + '/chat/';
                document.getElementById('chat-box').style.display = 'flex';
            }
            document.getElementById('setup').style.display = 'none';
            if (key) startBroadcasting(key);
        }

        function startBroadcasting(key) {
            const statusText = document.getElementById('status-text');
            const badge = document.getElementById('live-badge');
            statusText.innerText = "INITIALIZING...";

            let mime = pickMimeType();
            
            try {
                mediaRecorder = mime ? new MediaRecorder(window.localStream, { mimeType: mime }) : new MediaRecorder(window.localStream);
            } catch (e) {
                alert("Recorder Create Failed: " + e.message);
                return;
            }

            socket.emit('config', { 
                rtmp: 'rtmp://live.chaturbate.com/live/' + key,
                format: mime 
            }, (response) => {
                if (!response || !response.ok) {
                    alert("Server failed to spawn FFmpeg");
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

        function toggleCam() {
            const v = document.querySelector('video');
            v.style.transform = v.style.transform === 'scaleX(1)' ? 'scaleX(-1)' : 'scaleX(1)';
        }
        function resizeBox(id, size) {
            const el = document.getElementById(id);
            if(size === 'small') { el.style.width = '150px'; el.style.height = '120px'; }
            if(size === 'large') { el.style.width = '90vw'; el.style.height = '60vh'; }
        }
        function closeBox(id) { document.getElementById(id).style.display = 'none'; }
        let ghost = false;
        function toggleOpacity() {
            ghost = !ghost;
            const val = ghost ? '0.3' : '1';
            document.querySelectorAll('.overlay-box').forEach(el => el.style.opacity = val);
        }
        document.querySelectorAll('.drag-handle').forEach(handle => {
            handle.addEventListener('touchmove', (e) => {
                e.preventDefault();
                const box = document.getElementById(handle.dataset.target);
                const t = e.targetTouches[0];
                box.style.left = (t.pageX - 50) + 'px';
                box.style.top = (t.pageY - 10) + 'px';
            });
        });
    </script>
</body>
</html>
`;

// --- BACKEND ---
app.get('/', (req, res) => res.send(html));

io.on('connection', (socket) => {
    let ffmpeg;
    let streamQueue = []; 
    let isReady = false;

    socket.on('config', (data, ack) => {
        if (ffmpeg) ffmpeg.kill();
        
        console.log('Spawning FFmpeg. Target:', data.rtmp);

        // HARDENED FFMPEG ARGS
        const args = [
            '-i', '-',

            // 1. ROTATION FIX (Physically rotate pixels 90 deg clockwise)
            '-noautorotate',
            '-vf', 'transpose=1,scale=1280:720,setsar=1',
            '-metadata:s:v', 'rotate=0',

            // 2. VIDEO ENCODING (Hardened for Compatibility)
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-tune', 'zerolatency',
            '-pix_fmt', 'yuv420p',
            '-profile:v', 'baseline',
            '-level', '3.1',
            '-r', '30',
            '-g', '60',
            '-b:v', '2500k',
            '-maxrate', '2500k',
            '-bufsize', '5000k',

            // 3. AUDIO ENCODING
            '-c:a', 'aac',
            '-ar', '44100',
            '-b:a', '128k',

            // 4. RTMP OUTPUT
            '-flvflags', 'no_duration_filesize',
            '-f', 'flv',
            data.rtmp
        ];

        try {
            ffmpeg = spawn(ffmpegPath, args);
            
            // LOGGING: No truncation, see everything
            ffmpeg.stderr.on('data', (d) => console.log('FFmpeg:', d.toString()));
            ffmpeg.stdin.on('error', (e) => console.log('FFmpeg stdin error:', e.code, e.message));
            ffmpeg.on('close', (code, signal) => console.log('FFmpeg exited. code:', code, 'signal:', signal));
            ffmpeg.on('error', (e) => console.log('FFmpeg spawn error:', e.message));

            isReady = true;
            if (ack) ack({ ok: true });
            
            while(streamQueue.length > 0) {
                const chunk = streamQueue.shift();
                if (ffmpeg.stdin.writable) ffmpeg.stdin.write(chunk);
            }

        } catch (e) {
            console.error("Spawn Error:", e);
            if(ack) ack({ ok: false });
        }
    });

    socket.on('binarystream', (data) => {
        const buffer = Buffer.from(data);
        if (isReady && ffmpeg && ffmpeg.stdin.writable) {
            ffmpeg.stdin.write(buffer);
        } else {
            streamQueue.push(buffer);
        }
    });

    socket.on('disconnect', () => {
        if (ffmpeg) ffmpeg.kill();
    });
});

server.listen(port, () => console.log('Relay Pro running on ' + port));
