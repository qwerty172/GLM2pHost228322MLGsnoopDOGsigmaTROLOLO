#!/usr/bin/env bash
# Firecracker VM POC — requires Linux host with KVM and firecracker binary installed.
# Usage: FC_KERNEL=/path/to/vmlinux FC_ROOTFS=/path/to/rootfs.ext4 ./poc.sh

set -euo pipefail

SOCKET="/tmp/firecracker-poc.sock"
KERNEL="${FC_KERNEL:-./vmlinux}"
ROOTFS="${FC_ROOTFS:-./rootfs.ext4}"

if ! command -v firecracker >/dev/null 2>&1; then
  echo "firecracker binary not found — install from https://github.com/firecracker-microvm/firecracker"
  exit 1
fi

rm -f "$SOCKET"

cat > /tmp/fc-poc.json <<EOF
{
  "boot-source": {
    "kernel_image_path": "$KERNEL",
    "boot_args": "console=ttyS0 reboot=k panic=1 pci=off"
  },
  "drives": [{
    "drive_id": "rootfs",
    "path_on_host": "$ROOTFS",
    "is_root_device": true,
    "is_read_only": false
  }],
  "machine-config": {
    "vcpu_count": 2,
    "mem_size_mib": 512
  }
}
EOF

echo "Starting Firecracker POC VM (socket: $SOCKET)"
firecracker --api-sock "$SOCKET" &
FC_PID=$!
sleep 1

curl --unix-socket "$SOCKET" -X PUT "http://localhost/machine-config" \
  -H "Content-Type: application/json" \
  -d "$(jq '.["machine-config"]' /tmp/fc-poc.json)"

curl --unix-socket "$SOCKET" -X PUT "http://localhost/boot-source" \
  -H "Content-Type: application/json" \
  -d "$(jq '.["boot-source"]' /tmp/fc-poc.json)"

curl --unix-socket "$SOCKET" -X PUT "http://localhost/drives/rootfs" \
  -H "Content-Type: application/json" \
  -d "$(jq '.drives[0]' /tmp/fc-poc.json)"

curl --unix-socket "$SOCKET" -X PUT "http://localhost/actions" \
  -H "Content-Type: application/json" \
  -d '{"action_type": "InstanceStart"}'

echo "Firecracker VM started (pid $FC_PID). Press Ctrl+C to stop."
wait "$FC_PID"
