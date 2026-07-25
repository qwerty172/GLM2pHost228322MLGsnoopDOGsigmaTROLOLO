# ADR: Firecracker VDS Spike

## Status

Research / spike only (Phase 4 Wave 5). No production deployment.

## Context

DecentralHub VDS hosts today are provisioned over SSH (`quota_vds.provider = "ssh"`).
Firecracker micro-VMs would provide stronger isolation for always-on cloud gaming boxes,
but GPU passthrough constraints mean bare-metal hosts are required for NVENC/DXGI paths.

## Decision

1. Introduce a `VdsProvider` interface with `"ssh" | "firecracker"` variants.
2. Keep SSH as the only production provider in Phase 4.
3. Document Firecracker networking (TAP), API lifecycle, and GPU passthrough limits.
4. Share the `host-agent-native` module with a future headless Linux agent.

## Firecracker constraints

| Area | SSH (current) | Firecracker (target) |
|------|---------------|----------------------|
| Isolation | Process-level | VM-level |
| GPU | Direct on host | Passthrough / bare-metal only |
| Agent | Electron GUI | Headless + native capture |
| Provision | shell scripts | Firecracker API + cloud-init |

## POC

See `infra/firecracker/poc.sh` for a minimal create/start VM script (requires Linux + KVM).

## Next steps (post Phase 4)

- Linux headless agent using native capture module
- Firecracker provider implementing `VdsProvider`
- Automated image pipeline with pre-baked host-agent
