# nezha-geoip-frontend

External frontend assets for the customized Nezha dashboard.

This repository is the source of truth for the packaged frontend static files:

- `admin-dist/` - dashboard admin frontend assets
- `user-dist/` - public dashboard frontend assets

The panel image build copies these files into the Docker image so the runtime
container remains self-contained. The files are still served as external static
assets at runtime, so theme/resource changes do not require embedding assets
inside the Go binary.

## Build Flow

- The `nezha-panel` image build checks out this repo and copies `admin-dist/`
  and `user-dist/` into the image (replaces the old sync-to-panel step).
- The `argo-nezha-v1` image bakes these files into
  `/dashboard/default-frontend/` as the runtime fallback.
- On the live host, `/dashboard/{admin,user}-dist` are bind mounts over
  `/root/argo-nezha-v1/dashboard/{admin,user}-dist`, so edits there take
  effect immediately without any rebuild.

To ship a frontend-only update: push to this repo, then trigger
`build-dashboard-app-image` (nezha-panel) and `build-docker-image`
(argo-nezha-v1) manually, pull + recreate the container.

`scripts/sync-to-panel.sh` remains for local panel development only.

