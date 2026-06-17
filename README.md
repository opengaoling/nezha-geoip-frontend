# nezha-geoip-frontend

External frontend assets for the customized Nezha dashboard.

This repository is the source of truth for the packaged frontend static files:

- `admin-dist/` - dashboard admin frontend assets
- `user-dist/` - public dashboard frontend assets

The panel image build copies these files into the Docker image so the runtime
container remains self-contained. The files are still served as external static
assets at runtime, so theme/resource changes do not require embedding assets
inside the Go binary.

## Sync Into Panel Repository

From this repository:

```sh
./scripts/sync-to-panel.sh /path/to/nezha-geoip-panel
```

The script replaces:

- `/path/to/nezha-geoip-panel/cmd/dashboard/admin-dist`
- `/path/to/nezha-geoip-panel/cmd/dashboard/user-dist`

