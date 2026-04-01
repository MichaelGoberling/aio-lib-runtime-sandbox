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
    egress:             { type: 'string', multiple: true, short: 'e' }
  },
  strict: false
})

function parseEgressFlags (egressArgs) {
  if (!egressArgs || egressArgs.length === 0) return undefined

  const rules = egressArgs.map(arg => {
    // Split on | to separate L4 (host:port[:protocol]) from optional L7 (METHOD[,METHOD]:path)
    const pipeIdx = arg.indexOf('|')
    const l4Part = pipeIdx === -1 ? arg : arg.slice(0, pipeIdx)
    const l7Part = pipeIdx === -1 ? null : arg.slice(pipeIdx + 1)

    const parts = l4Part.split(':')
    if (parts.length < 2 || parts.length > 3) {
      console.error(`Invalid egress format: "${arg}". Expected host:port[:protocol][|METHOD:path]`)
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

    if (l7Part) {
      const colonIdx = l7Part.indexOf(':')
      if (colonIdx === -1 || !l7Part.slice(colonIdx + 1).startsWith('/')) {
        console.error(`Invalid L7 rule: "${arg}". Expected METHOD[,METHOD]:/ after |`)
        process.exit(1)
      }
      const methods = l7Part.slice(0, colonIdx).split(',').map(m => m.trim().toUpperCase())
      const pathPattern = l7Part.slice(colonIdx + 1)
      const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
      for (const method of methods) {
        if (!validMethods.includes(method)) {
          console.error(`Invalid HTTP method "${method}" in "${arg}". Must be one of: ${validMethods.join(', ')}`)
          process.exit(1)
        }
      }
      rule.rules = [{ methods, pathPattern }]
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
  const needsPrompt = !flags.apihost && !process.env.AIO_RUNTIME_APIHOST ||
                      !flags.namespace && !process.env.AIO_RUNTIME_NAMESPACE ||
                      !flags['api-key'] && !process.env.AIO_RUNTIME_AUTH

  if (needsPrompt) {
    await new Promise(resolve => setTimeout(resolve, 100))
    console.log('\n\x1b[1m── Adobe I/O Runtime Sandbox ──\x1b[0m\n')
  }

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

  let policy
  if (flags.egress) {
    if (flags.egress.length === 1 && flags.egress[0] === 'allow-all') {
      policy = { network: { egress: 'allow-all' } }
    } else {
      if (flags.egress.includes('allow-all')) {
        console.error('allow-all cannot be combined with other egress rules.')
        rl.close()
        process.exit(1)
      }
      policy = { network: { egress: parseEgressFlags(flags.egress).network.egress } }
    }
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
    if (policy.network.egress === 'allow-all') {
      console.log('Network policy: allow-all egress')
    } else {
      console.log('Network policy: custom egress')
      policy.network.egress.forEach(rule => {
        const proto = rule.protocol || 'TCP'
        const l7 = rule.rules ? ' ' + rule.rules.map(r => `${r.methods.join(',')}:${r.pathPattern}`).join(' ') : ''
        console.log(`  - ${rule.host}:${rule.port} (${proto})${l7}`)
      })
    }
  } else {
    console.log('Network policy: default-deny (DNS + NATS only)')
  }

  const { stdout, exitCode } = await sandbox.exec('node --version', { timeout: 10000 })
  console.log('Node version:', stdout.trim(), '| exit:', exitCode)

  console.log('\nSandbox ready. Type ".help" for commands, or "exit" to destroy and quit.\n')

  while (true) {
    const cmd = await ask('Enter command to run on sandbox: ')
    const trimmed = cmd.trim()
    if (trimmed === 'exit' || trimmed === 'quit') break
    if (!trimmed) continue

    if (trimmed === '.help') {
      printHelp()
      continue
    }

    try {
      if (trimmed.includes(' <<< ')) {
        await handleHereString(sandbox, trimmed)
      } else {
        await handleExec(sandbox, trimmed)
      }
    } catch (err) {
      console.error('exec error:', err.message)
    }
  }

  rl.close()
  await sandbox.destroy()
  console.log('Sandbox destroyed.')
}

function printHelp () {
  console.log(`
\x1b[1mHow it works:\x1b[0m
  Each command runs in a fresh process on the sandbox.
  Shell state (working directory, exports) does not persist between commands.
  To run multi-step workflows, chain commands: cd mydir && npm install

\x1b[1mStdin:\x1b[0m
  \x1b[36mcommand <<< "text"\x1b[0m        Send inline text as stdin
                              cat -n <<< "hello world"

\x1b[1mOther:\x1b[0m
  \x1b[36mexit / quit\x1b[0m               Destroy sandbox and exit
  \x1b[36m.help\x1b[0m                     Show this help
`)
}

async function handleExec (sandbox, cmd) {
  const result = await sandbox.exec(cmd, { timeout: 30000 })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  console.log(`[exit: ${result.exitCode}]`)
}

async function handleHereString (sandbox, input) {
  const idx = input.indexOf(' <<< ')
  const command = input.slice(0, idx).trim()
  let text = input.slice(idx + 5).trim()
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1)
  }
  text += '\n'

  console.log(`\x1b[2m(sending ${text.length} bytes to stdin)\x1b[0m`)
  const result = await sandbox.exec(command, { timeout: 30000, stdin: text })
  const hasOutput = result.stdout || result.stderr
  if (hasOutput) {
    console.log('<output>')
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
    console.log('</output>')
  }
  console.log(`[exit: ${result.exitCode}]\n`)
}

main().catch(err => { console.error(err.message || err); rl.close(); process.exit(1) })
