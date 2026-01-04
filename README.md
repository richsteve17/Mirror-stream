# Mirror Stream

Cam mirroring for Chaturbate & StripChat mobile streaming. Watch another performer while you stream.

## Why?

Mobile streaming apps don't mirror your cam, so text appears backwards. Plus when you're straight streaming to male viewers, you need something to watch. This solves both.

## Routes

- `/` - Landing page
- `/mobile` - Main tool: mirrored cam + draggable overlay to watch another performer
- `/broadcast` - Just the mirrored cam fullscreen
- `/watch` - Just the viewer

## How to Use

1. Go to `/mobile` on your phone
2. Allow camera access
3. Type a Chaturbate/StripChat username and tap Go
4. Drag the overlay wherever you want
5. Use your phone's split-screen or floating window with the streaming app

## Controls

- **M** - Toggle mirror on/off (red = on)
- **+** - Cycle overlay size (small → medium → large → fullscreen)
- **✕** - Close overlay
- **Drag** - Move overlay by the top bar

## Run Locally

```bash
npm install
npm start
# Opens at http://localhost:3000
```

## Deploy

Works on Railway, Render, Fly.io, Vercel, or any Node.js host. Set `PORT` env var if needed.
