# aio-lib-runtime-sandbox

Interactive CLI for working with Adobe I/O Runtime compute sandboxes.

## Usage

Get runtime credentials

```bash
npx aio-internal-login stage
```

Run directly with `npx` — no install or config files needed:

```bash
npx github:MichaelGoberling/aio-lib-runtime-sandbox
```

## .env File

If a `.env` file exists in the directory where you run the command, credentials will be read from it.

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
| `--egress` | `-e` | Egress rule in `host:port[:protocol][|METHOD:path]` format, or `allow-all` (repeatable) | |

## Network Policy

By default, sandboxes run with default-deny egress. Use `--egress` to allow specific outbound traffic.

```bash
# Mix L4-only rules with L7-filtered rules
npx github:MichaelGoberling/aio-lib-runtime-sandbox \
  --egress "pypi.org:443" \
  --egress "api.github.com:443|GET:/repos/**"
```

### Allow all

Pass `allow-all` as the egress value to permit all outbound traffic (useful for debugging):

```bash
npx github:MichaelGoberling/aio-lib-runtime-sandbox -e allow-all
```

### Default deny

When no flags are provided, all egress is denied.

```bash
npx github:MichaelGoberling/aio-lib-runtime-sandbox
```
