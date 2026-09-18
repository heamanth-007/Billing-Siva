# Siva Balaji Billing - VPS Deployment Guide (Hostinger / Ubuntu)

This guide provides step-by-step instructions to deploy the Siva Balaji Billing application (React Vite Frontend + Node/Express TypeScript Backend + Local MongoDB Server on VPS) on an Ubuntu VPS with domain **`siva-balaji-billing.gemshine.tech`** on **Port 5012**.

---

## 🏗️ Architecture Overview

```
                          Internet (User Request)
                                     │
                                     ▼
                         [ Nginx Web Server ] (Port 80 / 443 SSL)
                           siva-balaji-billing.gemshine.tech
                                     │
                ┌────────────────────┴────────────────────┐
                │                                         │
         Frontend Requests (/ & /assets/*)       Backend API Requests (/api/*)
                │                                         │
                ▼                                         ▼
    Static Files (/var/www/siva-balaji-billing/dist)   Express API (Port 5012 via PM2)
                                                          │
                                                          ▼
                                             Local MongoDB (Port 27017)
```

---

## 📋 Step 1: DNS Configuration (Hostinger / Domain Registrar)

In your DNS provider (where `gemshine.tech` is managed):
- **Type**: `A`
- **Name / Host**: `siva-balaji-billing`
- **Points to / Value**: `YOUR_VPS_IP_ADDRESS` (e.g. `187.127.148.51`)
- **TTL**: `300` (or Automatic)

---

## 💻 Step 2: VPS Server Setup & MongoDB Installation

Connect to your VPS via SSH:
```bash
ssh root@YOUR_VPS_IP
```

### 1. Update system packages & basic tools:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget gnupg ufw nginx certbot python3-certbot-nginx
```

### 2. Install Node.js (v20 LTS) & PM2:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### 3. 🍃 Install MongoDB Community Server on Ubuntu:
```bash
# 1. Import MongoDB Public GPG Key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor --yes

# 2. Add MongoDB APT Repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# 3. Update repositories & install MongoDB
sudo apt update
sudo apt install -y mongodb-org

# 4. Start & enable MongoDB on system boot
sudo systemctl start mongod
sudo systemctl enable mongod

# 5. Check MongoDB status
sudo systemctl status mongod --no-pager
```

### 4. Configure Firewall:
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 📂 Step 3: Clone Project & Directory Setup

```bash
sudo mkdir -p /var/www/siva-balaji-billing
sudo chown -R $USER:$USER /var/www/siva-balaji-billing
cd /var/www/siva-balaji-billing

# Clone your git repository:
git clone <YOUR_GIT_REPO_URL> .
```

---

## ⚙️ Step 4: Configure Environment Variables

### 1. Root `.env` (Frontend):
```bash
nano .env
```
Paste:
```env
VITE_API_URL=/api
```
*(Save: `Ctrl + O` -> `Enter`, Exit: `Ctrl + X`)*

### 2. Backend `server/.env`:
```bash
nano server/.env
```
Paste:
```env
PORT=5012
NODE_ENV=production
MONGODB_URI=mongodb://127.0.0.1:27017/siva_balaji_billing
CORS_ORIGIN=https://siva-balaji-billing.gemshine.tech
```

---

## 🚀 Step 5: Install Dependencies & Build

```bash
cd /var/www/siva-balaji-billing

# Install root, client & server dependencies
npm install
npm --prefix server install

# Build client and server
npm run build:all
```

---

## 🔄 Step 6: Start Backend with PM2 (Port 5012)

```bash
cd /var/www/siva-balaji-billing
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```
*(If `pm2 startup` gives you a command to run, copy and execute that command).*

Check status:
```bash
pm2 status
pm2 logs siva-balaji-billing-api
```

---

## 🌐 Step 7: Configure Nginx

```bash
# Copy Nginx config
sudo cp nginx/siva-balaji-billing.conf /etc/nginx/sites-available/siva-balaji-billing

# Enable the site
sudo ln -sf /etc/nginx/sites-available/siva-balaji-billing /etc/nginx/sites-enabled/

# Test Nginx syntax & reload
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔒 Step 8: Setup Free SSL (HTTPS) with Certbot

```bash
sudo certbot --nginx -d siva-balaji-billing.gemshine.tech
```

---

## ⚡ Future Updates (Single Step Deploy)

Whenever you push updates to GitHub, run this single command on your VPS:
```bash
cd /var/www/siva-balaji-billing
bash deploy.sh
```
