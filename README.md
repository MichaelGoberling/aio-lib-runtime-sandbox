# aio-lib-runtime-sandbox

Interactive CLI for working with Adobe I/O Runtime compute sandboxes.

## Usage

Run directly with `npx` — no install or config files needed:

```bash
npx github:MichaelGoberling/aio-lib-runtime-sandbox
```

You'll be prompted for your credentials:

```
API Host [https://adobeioruntime.net]: 
Namespace: my-namespace
API Key: ••••••••

Creating sandbox...
Created: sandbox-abc123
Node version: v20.11.0 | exit: 0

Sandbox ready. Type a command to execute, or "exit"/"quit" to destroy and exit.

> ls
> exit
Sandbox destroyed.
```

## .env File

If a `.env` file exists in the directory where you run the command, credentials will be read from it automatically — no prompts needed:

```
AIO_RUNTIME_APIHOST=https://adobeioruntime.net
AIO_RUNTIME_NAMESPACE=your-namespace
AIO_RUNTIME_AUTH=your-uuid:your-key
```

## Flags

You can also pass credentials as flags to skip the prompts:

```bash
npx github:MichaelGoberling/aio-lib-runtime-sandbox \
  --namespace my-namespace \
  --api-key uuid:key \
  --apihost https://adobeioruntime.net \
  --type cpu:nodejs \
  --size MEDIUM
```

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--namespace` | `-n` | Runtime namespace | |
| `--api-key` | `-k` | Runtime API key (`uuid:key`) | |
| `--apihost` | `-H` | API host | `https://adobeioruntime.net` |
| `--type` | `-t` | Sandbox type (optional) | |
| `--size` | `-s` | Sandbox size (optional) | |
| `--egress` | `-e` | Egress rule in `host:port[:protocol]` format (repeatable) | |
| `--network-policy` | `-p` | Named network policy preset (supported: `base`, `allow-all`) | |

## Network Policy

By default, sandboxes run with default deny all egress. Use `--network-policy` and/or `--egress` to control outbound access.

`--egress` rules are additive — they stack on top of any `--network-policy` preset. The one exception is `allow-all`, which already permits everything and cannot be combined with `--egress`.

### Named policy presets

| Preset | Description |
|--------|-------------|
| `base` | GitHub + PyPI + npm + Anthropic — sensible default for agent workloads |
| `allow-all` | All outbound traffic permitted (useful for dev/debug) |

```bash
npx github:MichaelGoberling/aio-lib-runtime-sandbox --network-policy base
npx github:MichaelGoberling/aio-lib-runtime-sandbox --network-policy allow-all
```

### Composing a preset with extra rules

Use `--egress` alongside `--network-policy base` to add hosts on top of the preset:

```bash
npx github:MichaelGoberling/aio-lib-runtime-sandbox \
  --network-policy base \
  --egress "myapi.example.com:443"
```

### Specific rules only

Use `--egress` on its own with format `host:port` or `host:port:protocol` (protocol default is TCP):

```bash
npx github:MichaelGoberling/aio-lib-runtime-sandbox \
  --egress "api.github.com:443" \
  --egress "pypi.org:443"
```

### Default deny

When no flags are provided, all egress is denied.

```bash
npx github:MichaelGoberling/aio-lib-runtime-sandbox
```
