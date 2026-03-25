#!/usr/bin/env node

require('dotenv').config()

const { parseArgs } = require('node:util')
const readline = require('node:readline')
const { init } = require('@adobe/aio-lib-runtime')

const { values: flags } = parseArgs({
  options: {
    namespace:          { type: 'string', short: 'n' },
    apihost:            { type: 'string', short: 'H' },
    'api-key':          { type: 'string', short: 'k' },
    type:               { type: 'string', short: 't' },
    size:               { type: 'string', short: 's' },
    egress:             { type: 'string', multiple: true, short: 'e' },
    'allow-all-egress': { type: 'boolean', default: false }
  },
  strict: false
})

function parseEgressFlags (egressArgs) {
  if (!egressArgs || egressArgs.length === 0) return undefined

  const rules = egressArgs.map(arg => {
    const parts = arg.split(':')
    if (parts.length < 2 || parts.length > 3) {
      console.error(`Invalid egress format: "${arg}". Expected host:port or host:port:protocol`)
      process.exit(1)
    }
    const port = parseInt(parts[1], 10)
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      console.error(`Invalid port in egress rule: "${arg}". Port must be 1–65535`)
      process.exit(1)
    }
    const rule = { host: parts[0], port }
    if (parts[2]) {
      const proto = parts[2].toUpperCase()
      if (proto !== 'TCP' && proto !== 'UDP') {
        console.error(`Invalid protocol in egress rule: "${arg}". Must be TCP or UDP`)
        process.exit(1)
      }
      rule.protocol = proto
    }
    return rule
  })

  return { network: { egress: rules } }
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

function ask (question) {
  return new Promise(resolve => rl.question(question, resolve))
}

async function main () {
  const apihost   = flags.apihost   || process.env.AIO_RUNTIME_APIHOST   || (await ask('API Host [https://adobeioruntime.net]: ')).trim() || 'https://adobeioruntime.net'
  const namespace = flags.namespace || process.env.AIO_RUNTIME_NAMESPACE  || (await ask('Namespace: ')).trim()
  const apiKey    = flags['api-key'] || process.env.AIO_RUNTIME_AUTH      || (await ask('API Key: ')).trim()
  const type      = flags.type
  const size      = flags.size

  if (!namespace || !apiKey) {
    console.error('Namespace and API Key are required.')
    rl.close()
    process.exit(1)
  }

  if (flags.egress && flags['allow-all-egress']) {
    console.error('--egress and --allow-all-egress are mutually exclusive.')
    rl.close()
    process.exit(1)
  }

  let policy
  if (flags['allow-all-egress']) {
    policy = { network: { egress: 'allow-all' } }
  } else if (flags.egress) {
    policy = parseEgressFlags(flags.egress)
  }

  const runtime = await init({ apihost, namespace, api_key: apiKey })

  console.log('\nCreating sandbox...')
  const sandbox = await runtime.compute.sandbox.create({
    name: 'my-sandbox',
    ...(type && { type }),
    ...(size && { size }),
    workspace: 'workspace',
    maxLifetime: 3600,
    envs: {},
    ...(policy && { policy })
  })
  console.log('Created:', sandbox.id)

  if (policy) {
    if (policy.network?.egress === 'allow-all') {
      console.log('Network policy: allow-all egress')
    } else if (Array.isArray(policy.network?.egress)) {
      console.log('Network policy: egress allowed to:')
      policy.network.egress.forEach(rule => {
        const proto = rule.protocol || 'TCP'
        console.log(`  - ${rule.host}:${rule.port} (${proto})`)
      })
    }
  } else {
    console.log('Network policy: default-deny (DNS + NATS only)')
  }

  const { stdout, exitCode } = await sandbox.exec('node --version', { timeout: 10000 })
  console.log('Node version:', stdout.trim(), '| exit:', exitCode)

  console.log('\nSandbox ready. Type a command to execute, or "exit"/"quit" to destroy and exit.\n')

  while (true) {
    const cmd = await ask('> ')
    if (cmd.trim() === 'exit' || cmd.trim() === 'quit') break
    if (!cmd.trim()) continue
    try {
      const result = await sandbox.exec(cmd, { timeout: 30000 })
      if (result.stdout) process.stdout.write(result.stdout)
      if (result.stderr) process.stderr.write(result.stderr)
      console.log(`[exit: ${result.exitCode}]`)
    } catch (err) {
      console.error('exec error:', err.message)
    }
  }

  rl.close()
  await sandbox.destroy()
  console.log('Sandbox destroyed.')
}

main().catch(err => { console.error(err.message || err); rl.close(); process.exit(1) })
