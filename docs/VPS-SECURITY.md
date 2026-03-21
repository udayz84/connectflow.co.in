# VPS security after compromise (xmrig / miners)

**Important:** This repo cannot run commands on your server. SSH into your VPS and run these steps yourself.

Miners are almost never caused only by `npm` — they usually mean **the server was breached** (weak SSH password, exposed port, leaked key, or a vulnerable app). Cleaning `node_modules` helps only if the malware lived there; you must also find **persistence** (cron, systemd, `.bashrc`, new users, backdoors).

## 1. Stop the miner immediately

```bash
sudo pkill -9 xmrig 2>/dev/null || true
sudo pkill -9 -f miner 2>/dev/null || true
ps aux | grep -E 'xmrig|miner|kdevtmpfsi|kinsing' | grep -v grep
```

## 2. Find persistence (do not skip)

```bash
# Cron (all users)
sudo crontab -l
crontab -l
sudo ls -la /etc/cron.* /var/spool/cron 2>/dev/null

# Systemd
systemctl list-units --type=service --state=running | grep -Ei 'xmrig|miner|crypto'
ls -la /etc/systemd/system/ ~/.config/systemd/user/ 2>/dev/null

# Shell startup
grep -E 'curl|wget|base64|xmrig|miner' ~/.bashrc ~/.profile /etc/profile 2>/dev/null

# Suspicious listening ports
sudo ss -tulpn
```

Remove anything you did not install. If unsure, **snapshot backups** before deleting system files.

## 3. Reinstall the app safely (project directory)

Use **one** package manager consistently (this project uses **pnpm**).

```bash
cd /path/to/connectflow   # your deploy path

# Remove possibly tampered install
rm -rf node_modules .next

# pnpm (recommended for this repo)
pnpm store prune
pnpm install --ignore-scripts

# Prisma needs its generate step (safe; not a random postinstall from unknown packages)
pnpm exec prisma generate

pnpm run build
```

If you use **npm** on the server instead:

```bash
rm -rf node_modules
rm -f package-lock.json   # only if you use npm; this repo ships pnpm-lock.yaml
npm cache clean --force
npm install --ignore-scripts
npx prisma generate
npm run build
```

Then:

```bash
npm audit
```

Fix or replace vulnerable packages; do not ignore critical issues without understanding them.

## 4. Harden the server (do this once)

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y ufw fail2ban unattended-upgrades htop

# Firewall: allow only SSH + your app port (example: 3005)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 3005/tcp   # adjust to your Next listen port
sudo ufw enable
sudo ufw status verbose
```

- **SSH:** disable password login, use keys only (`PasswordAuthentication no` in `sshd_config`).
- **No root SSH login** unless required (`PermitRootLogin no`).
- **Non-root user** to run the Node process; use `systemd` with `User=`.

## 5. Prevent repeat incidents

| Risk | Mitigation |
|------|------------|
| Stolen deploy keys | Rotate SSH keys and Git tokens; use deploy keys per repo |
| `.env` leaked | Rotate DB/API secrets; never commit real `.env` |
| Old Node/OS | `apt upgrade` + LTS Node via nvm or NodeSource |
| Random `curl \| bash` | Never run on production |
| Supply chain | Prefer lockfile installs; review `npm/pnpm` scripts; use `--ignore-scripts` after an incident, then run only needed tools (`prisma generate`) |

## 6. Monitor

```bash
htop
sudo journalctl -u your-app.service -f
```

If CPU is pegged and you see unknown processes, **isolate the VM**, capture `ps`, `ss`, and cron output, then rebuild from a clean image if the breach is deep.

---

Optional: run `scripts/vps-post-incident.sh` on the VPS **after** reading and editing paths/ports inside it.
