#!/bin/sh
set -e

# Fix volume ownership, then drop privileges.
#
# Railway (and Fly, and plain `docker run -v`) attach volumes owned by
# root:root mode 0755. The app runs unprivileged as `murafaa`, so it cannot
# write into its own storage directory: every document upload fails with
# EACCES. The container still starts, /api/health still returns 200, and the
# failure only surfaces when a lawyer tries to save a file.
#
# So the entrypoint starts as root purely to hand the mount to the app user,
# then execs the real process as `murafaa`. Node ends up as PID 1 via exec, so
# it still receives SIGTERM directly on shutdown.
#
# Nothing here runs as root beyond the chown. Chromium in particular must never
# run as root — it refuses to without --no-sandbox, and a browser parsing other
# people's case files is the last thing that should be privileged.

APP_UID=1001
APP_GID=1001

if [ "$(id -u)" = "0" ]; then
  # Only the local/volume drivers need a writable directory; gcs does not.
  if [ -n "$STORAGE_LOCAL_DIR" ] && [ -d "$STORAGE_LOCAL_DIR" ]; then
    owner=$(stat -c '%u' "$STORAGE_LOCAL_DIR")
    if [ "$owner" != "$APP_UID" ]; then
      echo "[entrypoint] taking ownership of $STORAGE_LOCAL_DIR for uid $APP_UID"
      # Recursive on purpose: a volume reattached from an older deployment can
      # hold root-owned subdirectories. Idempotent, and skipped entirely once
      # ownership is already correct, so it costs nothing on a normal restart.
      chown -R "$APP_UID:$APP_GID" "$STORAGE_LOCAL_DIR"
    fi
  fi
  exec gosu "$APP_UID:$APP_GID" "$@"
fi

# Already unprivileged (e.g. `docker run --user`): nothing to fix, just run.
exec "$@"
