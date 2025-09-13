#!/bin/sh
set -e

# Check if /data directory needs permission fixes
if [ ! -w "/data" ]; then
    # Check if we're running as root (can fix permissions)
    if [ "$(id -u)" = "0" ]; then
        echo "Fixing /data directory permissions..."
        chown noet:noet /data
        chmod 755 /data
    # Check if we're running as the noet user but can't write (bind mount issue)
    elif [ "$(id -u)" = "1000" ]; then
        echo "Warning: /data is not writable by user noet (1000:1000)"
        echo "This typically happens with bind mounts where the host directory has different ownership."
        echo ""
        echo "To fix this, run one of the following on the host:"
        echo "  sudo chown -R 1000:1000 <host-data-dir>   # Set ownership to container user"  
        echo "  chmod 777 <host-data-dir>                 # Make world-writable (less secure)"
        echo "  docker run --user \$(id -u):\$(id -g) ... # Run as host user instead"
        echo ""
        echo "Continuing anyway - the application may fail if it cannot write to /data"
    else
        # Running as different user, try basic permission fix
        echo "Warning: /data is not writable by user $(id -u):$(id -g)"
        echo "This may be a bind mount with incorrect permissions."
        chmod 755 /data 2>/dev/null || echo "Could not change permissions on /data"
    fi
fi

# Create database directory if it doesn't exist and we have permission
mkdir -p "$(dirname "${NOET_DB_PATH:-/data/noet.db}")" 2>/dev/null || {
    echo "Warning: Could not create database directory. Application may fail to start."
}

# If running as root, switch to noet user for security
if [ "$(id -u)" = "0" ]; then
    # Make sure noet user owns the database path directory
    chown -R noet:noet "$(dirname "${NOET_DB_PATH:-/data/noet.db}")" 2>/dev/null || true
    exec su-exec noet "$@"
else
    # Execute the main command as current user
    exec "$@"
fi