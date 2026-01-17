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
    pingTimeout: 60000
});

const port = process.env.PORT || 3000;

const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Stream Relay Hybrid</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        body { margin: 0; background: #000; overflow: hidden; height: 100vh; width: 100vw; font-family: sans-serif; }
        
        /* VIDEO LAYER */
        video { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); z-index: 1; }

        /* STATUS BAR */
        #status-bar { position: absolute; top: 0; left: 0; width: 100%; display: flex; justify-content: center; padding-top: 5px; z-index: 50; pointer-events: none; }
        .badge { background: rgba(0,0,0,0.6); color: #888; border: 1px solid #444; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; display: flex; align-items: center; gap: 8px; backdrop-filter: blur(4px); }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #555; }
        .badge.live { color: #fff; border-color: #f00; background: rgba(200,0,0,0.5); }
        .badge.live .dot { background: #f00; box-shadow: 0 0 8px #f00; }

        /* FLOATING WINDOWS */
        .overlay-box { 
            position: absolute; background: #1a1a1a; border: 1px solid #333; 
            z-index: 100; overflow: hidden; display: none; flex-direction: column; 
            box-shadow: 0 8px 20px rgba(0,0,0,0.8); border-radius: 8px;
        }
        
        /* DRAG HANDLE */
        .drag-handle { 
            width: 100%; height: 32px; background: #111; border-bottom: 1px solid #333;
            cursor: move; display: flex; align-items: center; justify-content: space-between; 
            padding: 0 8px; box-sizing: border-box; touch-action: none; 
        }
        .handle-title { color: #888; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
        .win-ctrls { display: flex; gap: 6px; }
        .win-btn { width: 12px; height: 12px; border-radius: 50%; border: none; cursor: pointer; }
        .btn-min { background: #febc2e; } 
        .btn-max { background: #28c840; } 
        .btn-close { background: #ff5f57; } 

        iframe { flex-grow: 1; border: none; width: 100%; background: #000; overflow-y: auto; -webkit-overflow-scrolling: touch; pointer-events: auto; }
        
        /* SETUP SCREEN */
        #setup { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #000; z-index: 300; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; overflow-y: auto; }
        input { padding: 15px; margin: 8px; font-size: 16px; width: 85%; max-width: 320px; border-radius: 8px; border: 1px solid #333; background: #222; color: #fff; outline: none; }
        label { color: #888; font-size: 11px; margin-top: 15px; text-transform: uppercase; letter-spacing: 1px; width: 85%; max-width: 320px; text-align: left; }
        button.start-btn { margin-top: 30px; padding: 18px 50px; font-size: 18px; background: #28c840; color: #000; border: none; font-weight: bold; border-radius: 30px; cursor: pointer; }
        
        /* BOTTOM CONTROLS */
        #controls { position: absolute; bottom: 30px; width: 100%; display: flex; justify-content: center; gap: 15px; z-index: 200; pointer-events: none; }
        .ctrl { pointer-events: auto; background: rgba(20,20,20,0.8); color: white; padding: 10px 16px; border-radius: 20px; border: 1px solid #444; font-size: 12px; text-transform: uppercase; font-weight: bold; backdrop-filter: blur(10px); }

        /* Default Sizes */
        #watch-box { top: 60px; right: 20px; width: 45vw; height: 35vh; }
        #chat-box { bottom: 100px; left: 20px; width: 45vw; height: 45vh; border-color: #28c840; }
    </style>
</head>
<body>
    <video autoplay playsinline muted></video>
    <div id="status-bar"><div class="badge" id="live-badge"><div class="dot"></div> <span id="status-text">READY</span></div></div>

    <div id="setup">
        <h2>Stream Config</h2>
        <label>RTMP URL (Saved automatically)</label>
        <input id="rtmpUrl" placeholder="global.live.mmcdn...">
        
        <label>BROADCAST TOKEN</label>
        <input id="streamKey" placeholder="Paste Token">
        
        <label>YOUR USERNAME</label>
        <input id="myUser" placeholder="e.g. richsteve17">
        
        <label>MONITOR USERNAME</label>
        <input id="watchUser" placeholder="e.g. othermodel">
        
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
        <button class="ctrl" onclick="clearData()">Reset Data</button>
    </div>

    <script>
        const socket = io({ transports: ["websocket"], reconnection: true });
        let mediaRecorder;

        // --- CLEAN USERNAME HELPER (Fixes buggy chat) ---
        function cleanUser(u) {
            if(!u) return "";
            return u.replace("https://", "").replace("http://", "").replace("www.", "")
                    .replace("chaturbate.com/", "").replace("chaturbate.com", "")
                    .split("/").join("").trim();
        }
        
        // --- AUTO-LOAD ---
        window.onload = () => {
            if(localStorage.getItem('rtmpUrl')) document.getElementById('rtmpUrl').value = localStorage.getItem('rtmpUrl');
            if(localStorage.getItem('streamKey')) document.getElementById('streamKey').value = localStorage.getItem('streamKey');
            if(localStorage.getItem('myUser')) document.getElementById('myUser').value = localStorage.getItem('myUser');
            if(localStorage.getItem('watchUser')) document.getElementById('watchUser').value = localStorage.getItem('watchUser');
            initCam();
        };

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
            
            // CLEAN USERNAMES TO PREVENT BUGS
            let myUser = cleanUser(document.getElementById('myUser').value);
            let watchUser = cleanUser(document.getElementById('watchUser').value);

            // SAVE DATA
            localStorage.setItem('rtmpUrl', rtmpUrl);
            localStorage.setItem('streamKey', key);
            localStorage.setItem('myUser', myUser);
            localStorage.setItem('watchUser', watchUser);

            // FIX URL
            if (!rtmpUrl.toLowerCase().startsWith('rtmp://')) rtmpUrl = 'rtmp://' + rtmpUrl;
            if (rtmpUrl.startsWith('RTMP://') || rtmpUrl.startsWith('Rtmp://')) rtmpUrl = 'rtmp://' + rtmpUrl.substring(7);
            if (!rtmpUrl.endsWith('/')) rtmpUrl += '/';

            // LOAD IFRAMES (With Sound Disabled by default for stability)
            if (watchUser) { 
                document.getElementById('watch-frame').src = 'https://chaturbate.com/embed/' + watchUser + '?bgcolor=black&sound=0'; 
                document.getElementById('watch-box').style.display = 'flex'; 
            }
            if (myUser) { 
                document.getElementById('chat-frame').src = 'https://chaturbate.com/popout/' + myUser + '/chat/?disable_sound=1'; 
                document.getElementById('chat-box').style.display = 'flex'; 
            }
            
            document.getElementById('setup').style.display = 'none';
            if (key && rtmpUrl) startBroadcasting(rtmpUrl, key);
        }

        function startBroadcasting(url, key) {
            const statusText = document.getElementById('status-text');
            const badge = document.getElementById('live-badge');
            statusText.innerText = "INITIALIZING...";

            const mime = ["video/mp4", "video/webm;codecs=h264", "video/webm"].find(t => MediaRecorder.isTypeSupported(t)) || "";

            try {
                mediaRecorder = mime ? new MediaRecorder(window.localStream, { mimeType: mime }) : new MediaRecorder(window.localStream);
            } catch (e) { alert("Recorder Error: " + e.message); return; }

            socket.emit('config', { target: url + key, format: mime }, (response) => {
                if (!response || !response.ok) { alert("Server Error (Check Logs)"); return; }
                mediaRecorder.start(250); 
                badge.classList.add('live');
                statusText.innerText = "LIVE (ON AIR)";
            });

            mediaRecorder.ondataavailable = async (e) => {
                if (e.data.size > 0) socket.emit('binarystream', await e.data.arrayBuffer());
            };
        }

        function toggleCam() { const v = document.querySelector('video'); v.style.transform = v.style.transform === 'scaleX(1)' ? 'scaleX(-1)' : 'scaleX(1)'; }
        
        function resizeBox(id, size) { 
            const el = document.getElementById(id); 
            if(size === 'small') { el.style.width = '150px'; el.style.height = '120px'; } 
            if(size === 'large') { el.style.width = '90vw'; el.style.height = '60vh'; } 
        }
        
        function closeBox(id) { document.getElementById(id).style.display = 'none'; }
        
        function clearData() {
            if(confirm("Clear saved keys?")) {
                localStorage.clear();
                location.reload();
            }
        }
        
        let ghost = false;
        function toggleOpacity() { 
            ghost = !ghost; 
            document.querySelectorAll('.overlay-box').forEach(el => el.style.opacity = ghost ? '0.3' : '1'); 
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

        // Socket Events for Status
        socket.on('error', (msg) => {
            document.getElementById('status-text').innerText = 'ERROR';
            console.log(msg);
        });
        socket.on('disconnect', () => {
            document.getElementById('status-text').innerText = 'DISCONNECTED';
            document.getElementById('live-badge').classList.remove('live');
        });
    </script>
</body>
</html>
`;

// --- BACKEND (PASSTHROUGH MODE - NO CRASHES) ---
app.get('/', (req, res) => res.send(html));

io.on('connection', (socket) => {
    let ffmpeg;
    let isReady = false;

    socket.on('config', (data, ack) => {
        if (ffmpeg) ffmpeg.kill();
        console.log('Target:', data.target);

        // PASSTHROUGH ARGS (CRITICAL FOR RENDER FREE TIER)
        const args = [
            '-i', '-',
            '-c:v', 'copy', // Copy Video (NO TRANSCODING)
            '-c:a', 'aac', '-ar', '44100', '-b:a', '128k', // Audio Encoding
            '-flvflags', 'no_duration_filesize',
            '-f', 'flv',
            data.target
        ];

        try {
            ffmpeg = spawn(ffmpegPath, args);
            
            ffmpeg.stderr.on('data', (d) => {
                const msg = d.toString();
                // console.log(msg); // Uncomment if you need deep debug
                if (msg.includes('Connection refused')) socket.emit('error', 'RTMP Connection Refused');
            });

            ffmpeg.on('close', (c) => { isReady = false; });
            ffmpeg.stdin.on('error', (e) => {}); 
            isReady = true;
            if (ack) ack({ ok: true });
        } catch (e) {
            console.error("Spawn Error:", e);
            if(ack) ack({ ok: false });
        }
    });

    socket.on('binarystream', (data) => {
        if (isReady && ffmpeg && ffmpeg.stdin.writable) {
            ffmpeg.stdin.write(Buffer.from(data));
        }
    });

    socket.on('disconnect', () => { if (ffmpeg) ffmpeg.kill(); });
});

server.listen(port, () => console.log('Relay Hybrid running on ' + port));
