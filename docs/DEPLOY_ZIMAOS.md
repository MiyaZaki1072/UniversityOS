# Run University OS on ZimaOS

This puts the app on your ZimaOS box with a database, so your planner is **saved on the server** and is the same on your phone, laptop and PC. A copy of the database is also written to a backup file **every day**.

What runs (all in Docker):

| Container | Job |
|---|---|
| `web` | The app itself, on port **8080** |
| `backend` | Login and saving (Django) |
| `db` | PostgreSQL database |
| `backup` | Dumps the database to `backups/` once a day, keeps 14 days |

---

## 1. Open a terminal on ZimaOS

SSH in from your PC (replace the IP with your ZimaOS address):

```bash
ssh your-zimaos-user@192.168.1.50
```

Then become root if your account needs it for Docker (`sudo -i`).

## 2. Get the code

```bash
mkdir -p /DATA/AppData && cd /DATA/AppData
git clone https://github.com/MiyaZaki1072/UniversityOS.git universityos
cd universityos
```

No `git`? Download the zip instead:

```bash
mkdir -p /DATA/AppData && cd /DATA/AppData
wget -O uos.zip https://github.com/MiyaZaki1072/UniversityOS/archive/refs/heads/main.zip
unzip uos.zip && mv UniversityOS-main universityos && rm uos.zip
cd universityos
```

## 3. Create the settings file with two secrets

```bash
cp .env.example .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')/" .env
sed -i "s/^DJANGO_SECRET_KEY=.*/DJANGO_SECRET_KEY=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')/" .env
```

Check it worked (both lines should show long random values):

```bash
grep -E '^(POSTGRES_PASSWORD|DJANGO_SECRET_KEY)=' .env
```

Keep `.env` private. Don't change `POSTGRES_PASSWORD` after the first start (the database keeps the first one).

## 4. Start it

```bash
docker compose up -d --build
```

The first build takes a few minutes. Check everything is running:

```bash
docker compose ps
```

All four services should say `running`. Test it:

```bash
curl http://localhost:8080/api/health/
```

You should see `{"status":"ok"}`.

## 5. Create your account

There is no sign-up page (on purpose). Create your login here:

```bash
docker compose exec backend python manage.py createsuperuser
```

Pick a username and a strong password. That's the login for the app.

## 6. Open it

- On your PC or phone, **on the same Wi-Fi**: `http://192.168.1.50:8080` (your ZimaOS IP).
- Sign in. Use **Import with AI** or add courses — everything saves to the server automatically. The cloud icon at the top shows **Saved** / **Saving…** / **Offline**.
- On the phone: open the page, then **Share → Add to Home Screen** (iPhone) or **⋮ → Add to Home screen** (Android).

If you were already using the app from another address (for example the GitHub Pages copy): open **Settings → Download backup** there, then on the server app **Settings → Restore backup**. It uploads to the server.

## 7. Use it away from home (recommended: Tailscale)

The app uses plain `http`, which is fine on your home Wi-Fi but **should not be opened to the internet**. Don't port-forward 8080 on your router.

To use it from campus, install **Tailscale** on ZimaOS (it's in the ZimaOS app store) and on your phone, sign both into the same account, then open `http://<zimaos-tailscale-ip>:8080`. Tailscale encrypts the connection end to end.

## 8. Backups

- A file like `backups/uos-20261110-0300.sql.gz` appears in `/DATA/AppData/universityos/backups` once a day (and once at every start). The last 14 days are kept.
- Copy that folder somewhere else now and then (another disk, cloud drive) — a backup on the same disk doesn't survive a dead disk.
- See the backup log: `docker compose logs backup`.
- You can also download a planner file any time from **Settings → Download backup** in the app.

**Restore a backup** (replaces the current database):

```bash
cd /DATA/AppData/universityos
gunzip -c backups/uos-YYYYMMDD-HHMM.sql.gz | docker compose exec -T backup psql -q -v ON_ERROR_STOP=1
docker compose restart backend
```

Then reopen the app on each device (pull down to refresh, or close and reopen).

## 9. Update to a new version

```bash
cd /DATA/AppData/universityos
git pull            # or download the zip again and copy your .env and backups/ into it
docker compose up -d --build
```

Your data lives in the Docker volume `universityos_postgres_data` and in `backups/`; updating doesn't touch them.

## Admin pages

`http://<zimaos-ip>:8080/manage/` — sign in with the same account. Useful to reset a password (Users) or look at the saved planner. Change the path with `ADMIN_URL` in `.env`.

## Troubleshooting

| Problem | Fix |
|---|---|
| `docker compose up` says `Set POSTGRES_PASSWORD in .env` | Step 3 wasn't done in this folder. |
| Page loads but sign-in says it can't reach the server | `docker compose ps` — is `backend` running? `docker compose logs backend` shows why not. |
| "Bad Request (400)" | You set `ALLOWED_HOSTS` in `.env`; add the address you're using, or set it back to `*`. |
| Sign-in fails with a CSRF error through an HTTPS proxy | Add the full address to `CSRF_TRUSTED_ORIGINS` in `.env`, e.g. `https://zimaos.tail1234.ts.net`, then `docker compose up -d`. |
| Forgot password | `docker compose exec backend python manage.py changepassword <username>` |
