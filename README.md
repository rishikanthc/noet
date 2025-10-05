# Noet

A minimal, text-focused blogging platform. Just write, save, and share.

## What is this?

Noet is a simple blogging system that gets out of your way. It’s basically a text editor that saves to a database and serves your posts as a website. No themes to configure, no plugins to manage, no complex admin panels. You write in a clean editor, your posts auto-save, and they show up on your site.

The editor supports the basics you’d expect—headings, lists, links, code blocks, math equations (via LaTeX), and images with markdown support. Posts can be public or private. The first heading in your post becomes the title. That’s about it.

## Why does this exist?

Sometimes you just want to write and publish without thinking about WordPress, static site generators, or managing a complex CMS. Noet is for those times. It’s a single binary you can run on a server, a Raspberry Pi, or locally on your laptop.

## Features

* **Rich text editor** with syntax highlighting for code, math equations (KaTeX), and inline images. Supports markdown syntax
* **Auto-save** while you type
* **Public/private posts** (toggle with a click)
* **@mentions** to link between posts
* **Image uploads** with size adjustment and captions
* **Clean, readable design** that doesn’t get in the way
* **Single binary** deployment (Go backend + embedded frontend)
* **SQLite database** (one file, easy backups)

## Tech stack

* **Backend**: Go (single binary, SQLite)
* **Frontend**: React, Vite, TypeScript
* **Editor**: Tiptap (extensible rich text)
* **Styling**: Custom CSS, no frameworks

## Getting started

### Option 1: Docker (easiest)

**Quick start with Docker Compose:**

````yaml
services:
  noet:
    image: ghcr.io/rishikanthc/noet:latest
    restart: unless-stopped
    ports:
      - "8081:8081"
    volumes:
      - ./data:/data
    environment:
      - NOET_DB_PATH=/data/noet.db
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8081/api/settings"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
````

Then run:

````bash
docker-compose up -d
````

Visit `http://localhost:8081` to get started. Your data will be saved in the `./data` directory.

**Behind a reverse proxy (Caddy):**

If you’re running Noet behind Caddy with automatic HTTPS:

````yaml
services:
  noet:
    image: ghcr.io/rishikanthc/noet:latest
    restart: unless-stopped
    networks:
      - caddy_net
    volumes:
      - ./data:/data
    environment:
      - NOET_DB_PATH=/data/noet.db
      - CORS_ALLOWED_ORIGINS=https://yourdomain.com
    labels:
      caddy: yourdomain.com
      caddy.reverse_proxy: "{{upstreams 8081}}"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8081/api/settings"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

networks:
  caddy_net:
    external: true
````

### Option 2: Run locally

**Prerequisites:**

* Go 1.21 or higher
* Node.js 18 or higher

**Build and run:**

````bash
# Build everything (frontend + backend)
./build.sh

# Run it
cd backend
./noet
````

Visit `http://localhost:8081` and create an account.

### Option 3: Build and deploy

**Build everything:**

````bash
./build.sh
````

The `backend/noet` binary is all you need. Copy it to your server and run it.

## Configuration

Noet uses environment variables:

* `NOET_DB_PATH` - SQLite database file location (default: `./noet.db`)
* `PORT` - Server port (default: `8081`)

## First time setup

When you first run Noet, visit the homepage and you’ll be prompted to create an admin account. That’s it. You’re ready to write.

## Usage tips

**Writing:**

* Start with a heading (`#` or `##` or `###`) for your post title
* Press `Ctrl/Cmd + K` to insert a link
* Type `$$` for block math equations, `$` for inline math
* Drag and drop images directly into the editor
* Click on images to adjust size or add captions

## Backing up

Since everything is in a single SQLite file, backups are simple:

````bash
# If running locally
cp noet.db noet-backup-$(date +%Y%m%d).db

# If using Docker with bind mount
tar -czf noet-backup-$(date +%Y%m%d).tar.gz data/
````

## License

MIT

