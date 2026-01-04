import express from 'express'
import { createClient } from '@supabase/supabase-js'
import axios from 'axios'

const app = express()
app.use(express.json())

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

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
          <a href="/login">Login with Chaturbate</a>
          <a href="/mobile">Open Mobile Tool</a>
          <a href="/broadcast" class="secondary">Broadcast Only</a>
          <a href="/watch" class="secondary">Watch Only</a>
        </div>
      </body>
    </html>
  `)
})

// Login page
app.get('/login', (req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Login - Mirror Stream</title>
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
          .login-box {
            background: #1a1a1a;
            padding: 2rem;
            border-radius: 12px;
            width: 100%;
            max-width: 400px;
            border: 1px solid #333;
          }
          h1 { font-size: 1.8rem; margin-bottom: 0.5rem; text-align: center; }
          p { color: #888; margin-bottom: 2rem; text-align: center; font-size: 14px; }
          .form-group { margin-bottom: 1rem; }
          label { display: block; margin-bottom: 0.5rem; font-size: 14px; }
          input {
            width: 100%;
            padding: 12px;
            border: 1px solid #333;
            border-radius: 6px;
            background: #222;
            color: #fff;
            font-size: 16px;
          }
          input:focus { outline: none; border-color: #e94560; }
          button {
            width: 100%;
            padding: 12px;
            background: #e94560;
            color: white;
            border: none;
            border-radius: 6px;
            font-weight: bold;
            cursor: pointer;
            font-size: 16px;
            margin-top: 1rem;
          }
          button:hover { background: #ff6b6b; }
          #status {
            margin-top: 1rem;
            text-align: center;
            font-size: 14px;
            min-height: 20px;
          }
          #status.error { color: #ff6b6b; }
          #status.success { color: #4ecdc4; }
          .back-link { text-align: center; margin-top: 2rem; }
          .back-link a { color: #e94560; text-decoration: none; }
          .back-link a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="login-box">
          <h1>Mirror Stream</h1>
          <p>Login with your Chaturbate account</p>
          <form id="loginForm">
            <div class="form-group">
              <label for="username">Username</label>
              <input type="text" id="username" name="username" required autocomplete="username">
            </div>
            <div class="form-group">
              <label for="password">Password</label>
              <input type="password" id="password" name="password" required autocomplete="current-password">
            </div>
            <button type="submit">Login</button>
            <div id="status"></div>
          </form>
        </div>
        <div class="back-link">
          <a href="/">Back to home</a>
        </div>
        <script>
          const form = document.getElementById('loginForm');
          const status = document.getElementById('status');

          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            status.textContent = 'Logging in...';
            status.className = '';

            try {
              const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
              });

              const data = await response.json();

              if (response.ok) {
                status.textContent = 'Login successful! Redirecting...';
                status.className = 'success';
                setTimeout(() => {
                  window.location.href = '/mobile';
                }, 1500);
              } else {
                status.textContent = data.error || 'Login failed';
                status.className = 'error';
              }
            } catch (e) {
              status.textContent = 'Error: ' + e.message;
              status.className = 'error';
            }
          });
        </script>
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
          #chatPanel {
            position: fixed;
            left: 0;
            top: 0;
            width: 200px;
            height: 100%;
            background: rgba(0,0,0,0.95);
            border-right: 2px solid #e94560;
            display: flex;
            flex-direction: column;
            z-index: 150;
          }
          #chatHeader {
            padding: 12px;
            border-bottom: 1px solid #333;
            font-weight: bold;
            font-size: 14px;
          }
          #chattersHeading {
            padding: 8px 12px;
            font-size: 12px;
            color: #888;
            margin-top: 8px;
          }
          #chattersList {
            flex: 0;
            padding: 8px 12px;
            font-size: 12px;
            max-height: 120px;
            overflow-y: auto;
          }
          .chatter { color: #4ecdc4; margin-bottom: 4px; }
          #messagesHeading {
            padding: 8px 12px;
            font-size: 12px;
            color: #888;
            margin-top: 8px;
          }
          #messagesList {
            flex: 1;
            padding: 12px;
            overflow-y: auto;
            font-size: 11px;
          }
          .chat-msg {
            margin-bottom: 8px;
            word-wrap: break-word;
          }
          .chat-msg .username { color: #e94560; font-weight: bold; font-size: 10px; }
          .chat-msg .text { color: #aaa; font-size: 11px; }
          .chat-msg.mine .username { color: #4ecdc4; }
          #pmInput {
            padding: 8px 12px;
            border-top: 1px solid #333;
            display: flex;
            gap: 4px;
          }
          #pmInput input {
            flex: 1;
            padding: 6px;
            border: 1px solid #333;
            border-radius: 4px;
            background: #222;
            color: #fff;
            font-size: 12px;
          }
          #pmInput button {
            padding: 6px 12px;
            background: #e94560;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 12px;
          }
          #pmInput button:hover { background: #ff6b6b; }
          #mainCam {
            margin-left: 200px;
          }
          #overlay {
            right: auto;
            left: 210px;
          }
          #controls {
            margin-left: 200px;
          }
        </style>
      </head>
      <body>
        <div id="chatPanel">
          <div id="chatHeader">Chat Monitor</div>
          <div id="chattersHeading">Active Chatters</div>
          <div id="chattersList"></div>
          <div id="messagesHeading">Messages</div>
          <div id="messagesList"></div>
          <div id="pmInput">
            <input type="text" id="pmRecipient" placeholder="@username">
            <input type="text" id="pmText" placeholder="msg">
            <button id="pmSendBtn">Send</button>
          </div>
        </div>

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
          const chattersList = document.getElementById('chattersList');
          const messagesList = document.getElementById('messagesList');
          const pmRecipient = document.getElementById('pmRecipient');
          const pmText = document.getElementById('pmText');
          const pmSendBtn = document.getElementById('pmSendBtn');

          let token = null;
          let username = null;
          const chatters = new Set();

          let mirrored = true;
          let sizes = [
            { w: 140, h: 105 },
            { w: 200, h: 150 },
            { w: 280, h: 210 },
            { w: '100%', h: '100%', full: true }
          ];
          let sizeIndex = 0;

          // Load token and start chat
          async function initChat() {
            try {
              const res = await fetch('/api/get-token');
              const data = await res.json();
              if (data.token && data.username) {
                token = data.token;
                username = data.username;
                loadChat();
                setInterval(loadChat, 2000);
              }
            } catch (e) {
              console.log('No token found');
            }
          }

          async function loadChat() {
            if (!token) return;
            try {
              const res = await fetch('/api/chat');
              const data = await res.json();
              updateChatDisplay(data.messages || []);
              updateChatters(data.messages || []);
            } catch (e) {
              console.error('Chat load error:', e);
            }
          }

          function updateChatDisplay(messages) {
            const recent = messages.slice(-20);
            messagesList.innerHTML = recent.map(m =>
              \`<div class="chat-msg \${m.is_mine ? 'mine' : ''}">
                <div class="username">\${m.username}</div>
                <div class="text">\${m.message}</div>
              </div>\`
            ).join('');
            messagesList.scrollTop = messagesList.scrollHeight;
          }

          function updateChatters(messages) {
            const unique = [...new Set(messages.map(m => m.username))];
            chattersList.innerHTML = unique.map(u =>
              \`<div class="chatter">\${u}</div>\`
            ).join('');
          }

          pmSendBtn.addEventListener('click', async () => {
            const to = pmRecipient.value.replace('@', '').trim();
            const msg = pmText.value.trim();
            if (!to || !msg) return;

            try {
              await fetch('/api/pm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to_user: to, message: msg })
              });
              pmText.value = '';
              pmRecipient.value = '';
            } catch (e) {
              console.error('PM error:', e);
            }
          });

          pmText.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') pmSendBtn.click();
          });

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
          initChat();

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

// API: Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const cbRes = await axios.post('https://chaturbate.com/api/token/', {
      username,
      password
    });

    const token = cbRes.data.token;

    const { error } = await supabase
      .from('auth_tokens')
      .upsert({ user_id: username, token }, { onConflict: 'user_id' });

    if (error) throw error;

    res.json({ success: true, token, username });
  } catch (e) {
    res.status(401).json({ error: 'Authentication failed: ' + (e.response?.data?.error || e.message) });
  }
});

// API: Get stored token
app.get('/api/get-token', async (req, res) => {
  try {
    const { data } = await supabase
      .from('auth_tokens')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      res.json({ token: data.token, username: data.user_id });
    } else {
      res.json({ token: null, username: null });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// API: Get chat messages
app.get('/api/chat', async (req, res) => {
  try {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .order('timestamp', { ascending: true })
      .limit(50);

    res.json({ messages: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// API: Send PM
app.post('/api/pm', async (req, res) => {
  const { to_user, message } = req.body;

  if (!to_user || !message) {
    return res.status(400).json({ error: 'to_user and message required' });
  }

  try {
    const { data: token_data } = await supabase
      .from('auth_tokens')
      .select('user_id')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const from_user = token_data?.user_id || 'unknown';

    const { error } = await supabase
      .from('private_messages')
      .insert({
        from_user,
        to_user,
        message,
        is_read: false
      });

    if (error) throw error;

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// API: Add chat message (for manual chat input if needed)
app.post('/api/add-chat', async (req, res) => {
  const { username, message, is_mine } = req.body;

  if (!username || !message) {
    return res.status(400).json({ error: 'username and message required' });
  }

  try {
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        username,
        message,
        is_mine: is_mine || false
      });

    if (error) throw error;

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Health check
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Mirror Stream running at http://localhost:${PORT}`)
})
