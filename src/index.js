import express from 'express';
import { Server } from 'socket.io';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import http from 'http';

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3000;

// 1. THE FRONTEND (Phone UI)
const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Broadcaster</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        body { margin: 0; background: #000; overflow: hidden; height: 100vh; font-family: sans-serif; }
        video { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
        
        #status {
            position: absolute; top: 10px; left: 10px; z-index: 500;
            background: rgba(0,0,0,0.7); color: #fff; padding: 5px 10px; border-radius: 5px; font-size: 12px;
            display: flex; align-items: center; gap: 5px;
        }
        .dot { width: 10px; height: 10px; border-radius: 50%; background: #555; }
        .live { background: #f00; box-shadow: 0 0 5px #f00; }

        #setup, #overlay-ui { position: absolute; z-index: 100; }
        #setup { 
            width: 100%; height: 100%; background: rgba(0,0,0,0.9); 
            display: flex; flex-direction: column; align-items: center; justify-content: center; color: white;
        }
        input { padding: 15px; margin: 10px; font-size: 16px; width: 250px; }
        button { padding: 15px 30px; font-size: 18px; background: #0f0; border: none; font-weight: bold; cursor: pointer; }
        
        /* WATCH BOX */
        #watch-box {
            position: absolute; top: 50px; right: 10px; width: 140px; height: 180px;
            background: #222; border: 1px solid #444; overflow: hidden; z-index: 200; display: none;
        }
        iframe { width: 100%; height: 100%; border: none; }
    </style>
</head>
<body>
    <video autoplay playsinline muted></video>
    
    <div id="status"><div class="dot" id="dot"></div> <span id="msg">OFFLINE</span></div>

    <div id="setup">
        <h2>Mobile Broadcaster</h2>
        <input id="key" placeholder="Enter Stream Key (Required)">
        <input id="watch" placeholder="Watch User (Optional)">
        <button onclick="startStream()">GO LIVE</button>
        <p style="font-size:12px; color:#aaa; margin-top:20px;">Use Chaturbate Stream Key, NOT password</p>
    </div>

    <div id="watch-box">
        <iframe id="watch-frame"></iframe>
    </div>

    <script>
        const socket = io();
        let mediaRecorder;
        
        // 1. Start Camera
        navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, 
            audio: true 
        }).then(stream => {
            document.querySelector('video').srcObject = stream;
            window.localStream = stream;
        });

        function startStream() {
            const key = document.getElementById('key').value;
            const watchUser = document.getElementById('watch').value;
            if(!key) return alert("Stream Key Needed!");

            // Setup Watcher
            if(watchUser) {
                document.getElementById('watch-frame').src = 'https://chaturbate.com/embed/' + watchUser + '?bgcolor=black';
                document.getElementById('watch-box').style.display = 'block';
            }

            document.getElementById('setup').style.display = 'none';
            
            // Start Server Relay
            socket.emit('config', { rtmp: 'rtmp://live.chaturbate.com/live/' + key });
            
            // Start Recording & Sending
            mediaRecorder = new MediaRecorder(window.localStream, { mimeType: 'video/webm;codecs=h264' });
            
            mediaRecorder.ondataavailable = (e) => {
                if(e.data.size > 0) socket.emit('binarystream', e.data);
            };
            
            mediaRecorder.start(250); // Send chunks every 250ms
            
            document.getElementById('dot').classList.add('live');
            document.getElementById('msg').innerText = "LIVE SENDING";
        }
    </script>
</body>
</html>
`;

// 2. THE BACKEND (FFmpeg Relay)
app.get('/', (req, res) => res.send(html));

io.on('connection', (socket) => {
    console.log('User connected');
    let ffmpeg;

    socket.on('config', (data) => {
        if (ffmpeg) ffmpeg.kill(); // Kill previous if exists
        console.log('Starting Stream to:', data.rtmp);

        // Spawn FFmpeg to transcode WebM (Browser) to FLV (RTMP)
        //
        ffmpeg = spawn(ffmpegPath, [
            '-i', '-',                // Input from stdin
            '-c:v', 'libx264',        // Video Codec
            '-preset', 'ultrafast',   // Speed over quality (critical for live)
            '-tune', 'zerolatency',   // Reduce delay
            '-c:a', 'aac',            // Audio Codec
            '-ar', '44100',           // Audio Rate
            '-b:a', '128k',           // Audio Bitrate
            '-f', 'flv',              // RTMP format
            data.rtmp                 // Chaturbate URL
        ]);

        ffmpeg.stderr.on('data', (d) => console.log('FFmpeg:', d.toString()));
        ffmpeg.on('close', (c) => console.log('FFmpeg exited:', c));
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

server.listen(port, () => console.log('Relay running on ' + port));
