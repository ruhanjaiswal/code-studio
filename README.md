# code-studio

A focused browser IDE for writing, previewing, and running HTML and C programs.

## Run locally

```bash
npm start
```

Open `http://localhost:3000`. The C runner uses `gcc`, so GCC must be installed.

## Features

- HTML/CSS/JavaScript editor with an instant live preview
- C editor with compile-and-run support
- Line and character counts
- Local draft saving
- Responsive VS Code-inspired interface

## Deploy

The interface can be hosted by GitHub Pages, but native C compilation requires the Node server. Deploy the Node server to a platform such as Render or Fly.io.
