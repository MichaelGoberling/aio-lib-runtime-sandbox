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
AIO_RUNTIME_API_KEY=your-uuid:your-key
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
