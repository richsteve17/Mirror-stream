import express from 'express';
import { Server } from 'socket.io';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import http from 'http';

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3000;

// --- FRONTEND (THE UI) ---
const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Stream Deck Relay</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        body { margin: 0; background: #000; overflow: hidden; height: 100vh; width: 100vw; font-family: sans-serif; }
        video { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
        #status-bar { position: absolute; top: 0; left: 0; width: 100%; display: flex; justify-content: center; padding-top: 5px; z-index: 50; }
        .badge { background: rgba(0,0,0,0.6); color: #888; border: 1px solid #444; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; display: flex; align-items: center; gap: 8px; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #555; }
        .badge.live { color: #fff; border-color: #f00; background: rgba(200,0,0,0.3); }
        .badge.live .dot { background: #f00; box-shadow: 0 0 8px #f00; }
        .overlay-box { position: absolute; background: #222; border: 1px solid #444; z-index: 100; overflow: hidden; display: none; flex-direction: column; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
        .drag-handle { width: 100%; height: 25px; background: rgba(0,0,0,0.8); cursor: move; display: flex; align-items: center; justify-content: center; color: #aaa; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; }
        iframe { flex-grow: 1; border: none; width: 100%; }
        #watch-box { top: 50px; right: 10px; width: 40vw; height: 25vh; }
        #chat-box { bottom: 80px; left: 10px; width: 45vw; height: 40vh; border: 1px solid #0f0; }
        #setup { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.92); z-index: 300; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; }
        input { padding: 12px; margin: 8px; font-size: 16px; width: 80%; max-width: 300px; border-radius: 5px; border: none; }
        label { color: #aaa; font-size: 12px; margin-top: 15px; align-self: center; }
        button.start-btn { margin-top: 20px; padding: 15px 40px; font-size: 18px; background: #0f0; border: none; font-weight: bold; border-radius: 5px; }
        #controls { position: absolute; bottom: 20px; width: 100%; display: flex; justify-content: center; gap: 10px; z-index: 200; pointer-events: none; }
        .ctrl { pointer-events: auto; background: rgba(0,0,0,0.6); color: white; padding: 8px 12px; border-radius: 15px; border: 1px solid #666; font-size: 12px;}
    </style>
</head>
<body>
    <video autoplay playsinline muted></video>
    <div id="status-bar"><div class="badge" id="live-badge"><div class="dot"></div> <span id="status-text">OFFLINE</span></div></div>
    <div id="setup">
        <h2>Stream Setup</h2>
        <label>STREAM KEY</label><input id="streamKey" placeholder="e.g. 8s9d-sd89-s8d9...">
        <label>YOUR USERNAME</label><input id="myUser" placeholder="Your Username">
        <label>WATCH USER</label><input id="watchUser" placeholder="Other Username">
        <button class="start-btn" onclick="startApp()">GO LIVE</button>
    </div>
    <div id="watch-box" class="overlay-box"><div class="drag-handle" data-target="watch-box">::: WATCH :::</div><iframe id="watch-frame"></iframe></div>
    <div id="chat-box" class="overlay-box"><div class="drag-handle" data-target="chat-box">::: MY CHAT :::</div><iframe id="chat-frame"></iframe></div>
    <div id="controls">
        <button class="ctrl" onclick="toggleCam()">Flip</button>
        <button class="ctrl" onclick="toggleSize('watch-box')">Size Watch</button>
        <button class="ctrl" onclick="toggleSize('chat-box')">Size Chat</button>
        <button class="ctrl" onclick="location.reload()">Reset</button>
    </div>
    <script>
        const socket = io();
        let mediaRecorder;
        
        async function initCam() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: "user", width: 1280, height: 720, frameRate: 30 }, 
                    audio: true 
                });
                document.querySelector('video').srcObject = stream;
                window.localStream = stream;
            } catch(e) { alert("Camera Error: " + e.message); }
        }
        initCam();

        function startApp() {
            const key = document.getElementById('streamKey').value;
            const myUser = document.getElementById('myUser').value;
            const watchUser = document.getElementById('watchUser').value;

            if (watchUser) {
                document.getElementById('watch-frame').src = 'https://chaturbate.com/embed/' + watchUser + '?bgcolor=black';
                document.getElementById('watch-box').style.display = 'flex';
            }
            if (myUser) {
                document.getElementById('chat-frame').src = 'https://chaturbate.com/popout/' + myUser + '/chat/';
                document.getElementById('chat-box').style.display = 'flex';
            }
            document.getElementById('setup').style.display = 'none';

            if (key) {
                startBroadcasting(key);
            }
        }

        function startBroadcasting(key) {
            const statusText = document.getElementById('status-text');
            const badge = document.getElementById('live-badge');
            
            statusText.innerText = "CONNECTING...";
            
            let options = { mimeType: 'video/webm;codecs=h264' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options = { mimeType: 'video/mp4' };
            }

            try {
                mediaRecorder = new MediaRecorder(window.localStream, options);
            } catch (e) {
                alert("Recorder Error: " + e.message);
                return;
            }

            socket.emit('config', { 
                rtmp: 'rtmp://live.chaturbate.com/live/' + key,
                format: options.mimeType 
            });

            mediaRecorder.ondataavailable = (e) => {
                if(e.data.size > 0) socket.emit('binarystream', e.data);
            };

            mediaRecorder.start(250); 
            
            badge.classList.add('live');
            statusText.innerText = "LIVE (SENDING)";
        }

        function toggleCam() {
            const v = document.querySelector('video');
            v.style.transform = v.style.transform === 'scaleX(1)' ? 'scaleX(-1)' : 'scaleX(1)';
        }

        const sizes = ['30%', '50%', '90%'];
        let sizeIdx = 0;
        function toggleSize(id) {
            const el = document.getElementById(id);
            sizeIdx = (sizeIdx + 1) % sizes.length;
            el.style.width = sizes[sizeIdx];
            el.style.height = (id === 'chat-box') ? '50vh' : 'auto';
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

// --- BACKEND (FFMPEG RELAY) ---
app.get('/', (req, res) => res.send(html));

io.on('connection', (socket) => {
    let ffmpeg;

    socket.on('config', (data) => {
        if (ffmpeg) ffmpeg.kill();
        
        // --- THIS LINE WAS THE PROBLEM ---
        console.log('Stream Starting. Target:', data.rtmp, 'Input Format:', data.format);
        // ---------------------------------

        const isMP4 = data.format && data.format.includes('mp4');

        const args = [
            '-i', '-',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-tune', 'zerolatency',
            '-r', '30',
            '-g', '60',
            '-c:a', 'aac',
            '-ar', '44100',
            '-b:a', '128k',
            '-f', 'flv',
            data.rtmp
        ];
        
        ffmpeg = spawn(ffmpegPath, args);

        ffmpeg.stderr.on('data', (d) => console.log('FFmpeg Log:', d.toString().substring(0, 100)));
        ffmpeg.on('close', (c) => console.log('FFmpeg stopped, code:', c));
    });

    socket.on('binarystream', (data) => {
        if (ffmpeg && ffmpeg.stdin.writable) {
            ffmpeg.stdin.write(data);
        }
    });

    socket.on('disconnect', () => {
        if (ffmpeg) ffmpeg.kill();
    });
});

server.listen(port, () => console.log('Server running on port ' + port));
