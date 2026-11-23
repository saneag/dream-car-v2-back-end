# Dream Car on PostgreSQL

The Express API uses PostgreSQL via `pg`. Users and cars have dedicated SQL
tables. Existing MongoDB IDs remain text IDs, so frontend links and ownership
references remain valid. Password hashes and image paths are preserved.
Image bytes stay in the persistent `dream-car_uploads_data` Docker volume.

## Existing home server

Keep both repositories side by side:

```
/home/alex/dream-car/dream-car-v2-back-end
/home/alex/dream-car/dream-car-v2-front-end
```

The server's existing PostgreSQL installation hosts separate `dream-car-dev`
and `dream-car-prod` databases with dedicated login roles. The app does not
run a MongoDB or PostgreSQL database container. Production uses the external
`home-apps` Docker network; its PostgreSQL role is allowed only from that subnet.
Development access is limited to localhost and the LAN. Production credentials
stay on the server in private files outside Git.

Copy `.env.example` to `.env` and configure `DATABASE_URL` and a random
`JWT_SECRET`. Containers use `host.docker.internal` to reach the host database;
Compose maps it to the host gateway. For development use the server's LAN address
and the development database login. Never use the PostgreSQL administrator login.

## Migrate hosted MongoDB data

Do this before making the new site public. Pause writes to the old app during
the final export. Keep the hosted database intact until verification completes.

The migration-only MongoDB driver is a development dependency. It is excluded
from the runtime image. Install dependencies in a separate migration environment
with `npm ci --ignore-scripts`.

Set `SOURCE_MONGO_URI` privately and set `MONGO_BACKUP_PATH` to a new file outside
the repositories. Then run:

```sh
node scripts/import-mongodb.js export
node scripts/migrate.js
node scripts/import-mongodb.js import
```

The export reads users and cars without modifying MongoDB. It creates a private
JSON backup and refuses to overwrite an existing file. The importer requires an
empty SQL target, inserts records in one transaction, checks counts and stored
fields including password hashes, and rolls back on failure. Repeat the import
separately for development if desired. Neither database can be overwritten by
rerunning the importer. Do not commit dumps or source connection settings.

Copy every referenced local image into the uploads volume before launch. The
repository contains some uploads, but the hosted app may have additional files.
Inspect external image references and migrate those files separately if needed.
MongoDB contains image paths, not the image bytes.

## One-command deployment

Install `~/bin/start-dream-car` with these contents:

```sh
#!/usr/bin/env bash
exec bash /home/alex/dream-car/dream-car-v2-back-end/scripts/start-dream-car.sh "$@"
```

Make it executable and run:

```sh
~/bin/start-dream-car
```

This refuses tracked local edits, pulls both repositories with `git pull
--ff-only` as their checkout owner, builds before stopping the running app,
selects free ports starting at 5004/5005, applies the idempotent SQL schema,
waits for database health, and starts its own Cloudflare tunnel. Push changes
to GitHub first. Pushes alone do not trigger deployment.

The launcher needs sudo and uses its own lock and tunnel service. Its transient
tunnel must be started again after reboot; its public URL changes each launch.
Keep the Compose project name `dream-car` stable to retain uploaded files.
Never run `docker compose down -v` when updating.

## Verification and logs

From the backend directory:

```sh
sudo docker compose ps
sudo docker compose logs --tail=50 api
sudo journalctl -u dream-car-tunnel -b --no-pager
```

Check the public page, `/api/health` (200), `/api/auth/me` (403 without a token),
and `/api/cars?page=1&limit=12&sortBy=brand&sortOrder=1` (migrated records).
Verify representative `/api/uploads/...` images. Nginx strips `/api/` and uses
the unique `dream-car-api` alias, avoiding other apps' API services.

`node scripts/test-postgres.js` runs real HTTP authentication and car CRUD tests
in a temporary schema and removes it afterward. Use only a development database
login that can create schemas. It does not use or modify existing app tables.

For backups, pause app writes, use `pg_dump` for the production database, and
archive the matching uploads volume. Keep both outside repositories with private
permissions. Test restoration to a separate database before relying on backups.
