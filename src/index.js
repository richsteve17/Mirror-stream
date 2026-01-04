import express from 'express'

const app = express()

// Landing page
app.get('/', (req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Mirror Stream</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: system-ui, sans-serif;
            background: #0d0d0d;
            color: #fff;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem;
          }
          h1 { font-size: 2rem; margin-bottom: 1rem; }
          p { color: #888; margin-bottom: 2rem; text-align: center; }
          .links { display: flex; flex-direction: column; gap: 1rem; width: 100%; max-width: 300px; }
          a {
            display: block;
            background: #e94560;
            color: white;
            text-decoration: none;
            padding: 1rem 2rem;
            border-radius: 8px;
            text-align: center;
            font-weight: bold;
          }
          a:hover { background: #ff6b6b; }
          a.secondary { background: #333; }
          a.secondary:hover { background: #444; }
        </style>
      </head>
      <body>
        <h1>Mirror Stream</h1>
        <p>Cam mirroring for Chaturbate & StripChat<br>Watch another performer while you stream</p>
        <div class="links">
          <a href="/mobile">Open Mobile Tool</a>
          <a href="/broadcast" class="secondary">Broadcast Only</a>
          <a href="/watch" class="secondary">Watch Only</a>
        </div>
      </body>
    </html>
  `)
})

// Mobile streaming page - mirrored cam + overlay viewer
app.get('/mobile', (req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
        <title>Mirror Stream</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            width: 100%;
            height: 100%;
            background: #000;
            overflow: hidden;
            touch-action: manipulation;
          }
          #mainCam {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transform: scaleX(-1);
          }
          #overlay {
            position: fixed;
            bottom: 80px;
            right: 10px;
            width: 140px;
            height: 105px;
            background: #111;
            border: 2px solid #e94560;
            border-radius: 8px;
            overflow: hidden;
            z-index: 100;
            display: none;
          }
          #overlay.visible { display: block; }
          #overlay iframe, #overlay video {
            width: 100%;
            height: 100%;
            border: none;
          }
          #overlayHandle {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 24px;
            background: rgba(0,0,0,0.7);
            cursor: move;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: #888;
          }
          #overlayClose {
            position: absolute;
            top: 2px;
            right: 4px;
            background: none;
            border: none;
            color: #e94560;
            font-size: 16px;
            cursor: pointer;
            z-index: 10;
          }
          #overlayResize {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 20px;
            height: 20px;
            cursor: nwse-resize;
            background: linear-gradient(135deg, transparent 50%, #e94560 50%);
          }
          #controls {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 10px;
            background: rgba(0,0,0,0.8);
            display: flex;
            gap: 8px;
            z-index: 200;
          }
          #controls input {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 6px;
            background: #222;
            color: #fff;
            font-size: 16px;
          }
          #controls button {
            padding: 12px 16px;
            border: none;
            border-radius: 6px;
            font-weight: bold;
            cursor: pointer;
          }
          .btn-go { background: #e94560; color: white; }
          .btn-mirror { background: #333; color: white; }
          .btn-mirror.active { background: #e94560; }
          .btn-size { background: #333; color: white; }
          #status {
            position: fixed;
            top: 10px;
            left: 10px;
            color: #e94560;
            font-size: 12px;
            z-index: 50;
          }
        </style>
      </head>
      <body>
        <video id="mainCam" autoplay playsinline muted></video>

        <div id="overlay">
          <div id="overlayHandle">⋮⋮ drag ⋮⋮</div>
          <button id="overlayClose">✕</button>
          <div id="overlayResize"></div>
          <iframe id="overlayFrame" allow="autoplay"></iframe>
        </div>

        <div id="status"></div>

        <div id="controls">
          <input type="text" id="streamInput" placeholder="Username or URL...">
          <button class="btn-go" id="goBtn">Go</button>
          <button class="btn-mirror active" id="mirrorBtn">M</button>
          <button class="btn-size" id="sizeBtn">+</button>
        </div>

        <script>
          const mainCam = document.getElementById('mainCam');
          const overlay = document.getElementById('overlay');
          const overlayFrame = document.getElementById('overlayFrame');
          const overlayHandle = document.getElementById('overlayHandle');
          const overlayClose = document.getElementById('overlayClose');
          const overlayResize = document.getElementById('overlayResize');
          const streamInput = document.getElementById('streamInput');
          const goBtn = document.getElementById('goBtn');
          const mirrorBtn = document.getElementById('mirrorBtn');
          const sizeBtn = document.getElementById('sizeBtn');
          const status = document.getElementById('status');

          let mirrored = true;
          let sizes = [
            { w: 140, h: 105 },
            { w: 200, h: 150 },
            { w: 280, h: 210 },
            { w: '100%', h: '100%', full: true }
          ];
          let sizeIndex = 0;

          // Start camera immediately
          async function startCam() {
            try {
              status.textContent = 'Starting camera...';
              const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
              });
              mainCam.srcObject = stream;
              status.textContent = '';
            } catch (e) {
              status.textContent = 'Camera error: ' + e.message;
            }
          }
          startCam();

          // Mirror toggle
          mirrorBtn.addEventListener('click', () => {
            mirrored = !mirrored;
            mainCam.style.transform = mirrored ? 'scaleX(-1)' : 'scaleX(1)';
            mirrorBtn.classList.toggle('active', mirrored);
          });

          // Load stream
          function loadStream(input) {
            if (!input.trim()) return;
            let url;
            // Just a username - assume Chaturbate
            if (!input.includes('/') && !input.includes('.')) {
              url = 'https://chaturbate.com/fullvideo/?b=' + input.trim();
            } else if (input.includes('chaturbate.com')) {
              const parts = input.split('/').filter(p => p && !p.includes('.'));
              const username = parts[parts.length - 1];
              url = 'https://chaturbate.com/fullvideo/?b=' + username;
            } else if (input.includes('stripchat.com')) {
              url = input;
            } else {
              url = input;
            }
            overlayFrame.src = url;
            overlay.classList.add('visible');
          }

          goBtn.addEventListener('click', () => loadStream(streamInput.value));
          streamInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loadStream(streamInput.value);
          });

          // Close overlay
          overlayClose.addEventListener('click', () => {
            overlay.classList.remove('visible');
            overlayFrame.src = '';
          });

          // Size cycling
          sizeBtn.addEventListener('click', () => {
            sizeIndex = (sizeIndex + 1) % sizes.length;
            const s = sizes[sizeIndex];
            if (s.full) {
              overlay.style.width = '100%';
              overlay.style.height = '100%';
              overlay.style.top = '0';
              overlay.style.left = '0';
              overlay.style.right = '0';
              overlay.style.bottom = '0';
              overlay.style.borderRadius = '0';
            } else {
              overlay.style.width = s.w + 'px';
              overlay.style.height = s.h + 'px';
              overlay.style.top = '';
              overlay.style.left = '';
              overlay.style.right = '10px';
              overlay.style.bottom = '80px';
              overlay.style.borderRadius = '8px';
            }
          });

          // Dragging
          let dragging = false, dragX, dragY, startLeft, startTop;
          overlayHandle.addEventListener('touchstart', (e) => {
            dragging = true;
            const t = e.touches[0];
            const rect = overlay.getBoundingClientRect();
            dragX = t.clientX;
            dragY = t.clientY;
            startLeft = rect.left;
            startTop = rect.top;
            e.preventDefault();
          });
          overlayHandle.addEventListener('mousedown', (e) => {
            dragging = true;
            const rect = overlay.getBoundingClientRect();
            dragX = e.clientX;
            dragY = e.clientY;
            startLeft = rect.left;
            startTop = rect.top;
          });
          document.addEventListener('touchmove', (e) => {
            if (!dragging) return;
            const t = e.touches[0];
            overlay.style.left = (startLeft + t.clientX - dragX) + 'px';
            overlay.style.top = (startTop + t.clientY - dragY) + 'px';
            overlay.style.right = 'auto';
            overlay.style.bottom = 'auto';
          });
          document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            overlay.style.left = (startLeft + e.clientX - dragX) + 'px';
            overlay.style.top = (startTop + e.clientY - dragY) + 'px';
            overlay.style.right = 'auto';
            overlay.style.bottom = 'auto';
          });
          document.addEventListener('touchend', () => dragging = false);
          document.addEventListener('mouseup', () => dragging = false);

          // Resizing
          let resizing = false, resizeW, resizeH, resizeX, resizeY;
          overlayResize.addEventListener('touchstart', (e) => {
            resizing = true;
            const t = e.touches[0];
            resizeW = overlay.offsetWidth;
            resizeH = overlay.offsetHeight;
            resizeX = t.clientX;
            resizeY = t.clientY;
            e.preventDefault();
          });
          overlayResize.addEventListener('mousedown', (e) => {
            resizing = true;
            resizeW = overlay.offsetWidth;
            resizeH = overlay.offsetHeight;
            resizeX = e.clientX;
            resizeY = e.clientY;
          });
          document.addEventListener('touchmove', (e) => {
            if (!resizing) return;
            const t = e.touches[0];
            overlay.style.width = Math.max(100, resizeW - (t.clientX - resizeX)) + 'px';
            overlay.style.height = Math.max(80, resizeH + (t.clientY - resizeY)) + 'px';
          });
          document.addEventListener('mousemove', (e) => {
            if (!resizing) return;
            overlay.style.width = Math.max(100, resizeW - (e.clientX - resizeX)) + 'px';
            overlay.style.height = Math.max(80, resizeH + (e.clientY - resizeY)) + 'px';
          });
          document.addEventListener('touchend', () => resizing = false);
          document.addEventListener('mouseup', () => resizing = false);
        </script>
      </body>
    </html>
  `)
})

// Broadcast page - clean fullscreen mirrored cam
app.get('/broadcast', (req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Broadcast - Mirror Stream</title>
        <style>
          * { margin: 0; padding: 0; }
          html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
          video {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transform: scaleX(-1);
          }
          #toggle {
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.7);
            border: none;
            color: #e94560;
            padding: 10px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            opacity: 0;
            transition: opacity 0.3s;
          }
          body:hover #toggle { opacity: 1; }
        </style>
      </head>
      <body>
        <video id="cam" autoplay playsinline muted></video>
        <button id="toggle">Mirror: ON</button>
        <script>
          const cam = document.getElementById('cam');
          const toggle = document.getElementById('toggle');
          let mirrored = true;

          navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false
          }).then(stream => cam.srcObject = stream);

          toggle.addEventListener('click', () => {
            mirrored = !mirrored;
            cam.style.transform = mirrored ? 'scaleX(-1)' : 'scaleX(1)';
            toggle.textContent = 'Mirror: ' + (mirrored ? 'ON' : 'OFF');
          });
        </script>
      </body>
    </html>
  `)
})

// Watch page - view other performers
app.get('/watch', (req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Watch - Mirror Stream</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: 100%; height: 100%; background: #0d0d0d; }
          #viewer {
            width: 100%;
            height: calc(100% - 60px);
            border: none;
          }
          #controls {
            height: 60px;
            padding: 10px;
            background: #111;
            display: flex;
            gap: 10px;
          }
          input {
            flex: 1;
            padding: 10px;
            border: none;
            border-radius: 6px;
            background: #222;
            color: #fff;
            font-size: 16px;
          }
          button {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            background: #e94560;
            color: white;
            font-weight: bold;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <iframe id="viewer"></iframe>
        <div id="controls">
          <input type="text" id="input" placeholder="Username or URL...">
          <button id="go">Load</button>
        </div>
        <script>
          const viewer = document.getElementById('viewer');
          const input = document.getElementById('input');
          const go = document.getElementById('go');

          function load() {
            let val = input.value.trim();
            if (!val) return;
            let url;
            if (!val.includes('/') && !val.includes('.')) {
              url = 'https://chaturbate.com/fullvideo/?b=' + val;
            } else if (val.includes('chaturbate.com')) {
              const parts = val.split('/').filter(p => p && !p.includes('.'));
              url = 'https://chaturbate.com/fullvideo/?b=' + parts[parts.length - 1];
            } else {
              url = val;
            }
            viewer.src = url;
          }

          go.addEventListener('click', load);
          input.addEventListener('keypress', (e) => { if (e.key === 'Enter') load(); });
        </script>
      </body>
    </html>
  `)
})

// Health check
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Mirror Stream running at http://localhost:${PORT}`)
})
