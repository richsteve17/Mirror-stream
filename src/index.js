import express from 'express';
const app = express();
const port = process.env.PORT || 3000;

const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Stream Deck</title>
    <style>
        /* BASE SETUP */
        body { margin: 0; background: #000; overflow: hidden; height: 100vh; width: 100vw; font-family: sans-serif; }
        
        /* 1. YOUR CAMERA (Mirrored) */
        video { 
            position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
            object-fit: cover; transform: scaleX(-1); 
        }

        /* 2. OVERLAYS (Common Styles) */
        .overlay-box {
            position: absolute; background: #222; border: 1px solid #555;
            z-index: 100; overflow: hidden; display: none; flex-direction: column;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        }
        .drag-handle {
            width: 100%; height: 25px; background: rgba(0,0,0,0.8);
            cursor: move; display: flex; align-items: center; justify-content: center;
            color: #666; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;
        }
        iframe { flex-grow: 1; border: none; width: 100%; }

        /* Specific Overlay Positions */
        #watch-box { top: 10px; right: 10px; width: 40vw; height: 30vh; }
        #chat-box { bottom: 80px; left: 10px; width: 45vw; height: 40vh; border-color: #0f0; }

        /* 3. SETUP SCREEN */
        #setup {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.92); z-index: 300;
            display: flex; flex-direction: column; align-items: center; justify-content: center; color: white;
        }
        input { padding: 12px; margin: 10px; font-size: 16px; width: 220px; border-radius: 5px; border: none; }
        label { color: #aaa; font-size: 12px; margin-top: 10px; }
        button.start-btn { margin-top: 20px; padding: 15px 40px; font-size: 18px; background: #0f0; border: none; font-weight: bold; border-radius: 5px; }

        /* 4. CONTROLS */
        #controls {
            position: absolute; bottom: 20px; width: 100%;
            display: flex; justify-content: center; gap: 15px; z-index: 200; pointer-events: none;
        }
        .ctrl { pointer-events: auto; background: rgba(0,0,0,0.6); color: white; padding: 8px 16px; border-radius: 20px; border: 1px solid #666; font-size: 12px;}
    </style>
</head>
<body>
    <video autoplay playsinline muted></video>
    
    <div id="setup">
        <h1>Stream Deck</h1>
        
        <label>YOU (For Chat/PMs)</label>
        <input id="myUser" placeholder="Your Username">
        
        <label>WATCH (Entertainment)</label>
        <input id="watchUser" placeholder="Other Username">
        
        <button class="start-btn" onclick="start()">GO LIVE</button>
    </div>

    <div id="watch-box" class="overlay-box">
        <div class="drag-handle" data-target="watch-box">::: WATCH :::</div>
        <iframe id="watch-frame"></iframe>
    </div>

    <div id="chat-box" class="overlay-box">
        <div class="drag-handle" data-target="chat-box">::: MY CHAT :::</div>
        <iframe id="chat-frame"></iframe>
    </div>

    <div id="controls">
        <button class="ctrl" onclick="toggleCam()">Flip Cam</button>
        <button class="ctrl" onclick="toggleSize('watch-box')">Resize Watch</button>
        <button class="ctrl" onclick="toggleSize('chat-box')">Resize Chat</button>
        <button class="ctrl" onclick="location.reload()">Reset</button>
    </div>

    <script>
        // 1. START CAMERA
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
            .then(s => document.querySelector('video').srcObject = s)
            .catch(e => console.log(e));
        
        // 2. APP LOGIC
        function start() {
            const myUser = document.getElementById('myUser').value;
            const watchUser = document.getElementById('watchUser').value;

            if (watchUser) {
                // Load other performer
                document.getElementById('watch-frame').src = 'https://chaturbate.com/embed/' + watchUser + '?bgcolor=black';
                document.getElementById('watch-box').style.display = 'flex';
            }
            
            if (myUser) {
                // Load YOUR chat (Popout version is cleanest)
                // You may need to log in inside this little box once!
                document.getElementById('chat-frame').src = 'https://chaturbate.com/popout/' + myUser + '/chat/';
                document.getElementById('chat-box').style.display = 'flex';
            }

            document.getElementById('setup').style.display = 'none';
        }

        // 3. UTILITIES
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
            el.style.height = (id === 'chat-box') ? '50vh' : 'auto'; // approximate
        }

        // 4. DRAG LOGIC (Simple Touch)
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

app.get('*', (req, res) => res.send(html));
app.listen(port, () => console.log('Deck running!'));
