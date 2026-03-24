#!/usr/bin/env node

const { parseArgs } = require('util')
const readline = require('readline')
const { init } = require('@adobe/aio-lib-runtime')

const { values: flags } = parseArgs({
  options: {
    namespace: { type: 'string', short: 'n' },
    apihost:   { type: 'string', short: 'H' },
    'api-key': { type: 'string', short: 'k' },
    type:      { type: 'string', short: 't' },
    size:      { type: 'string', short: 's' }
  },
  strict: false
})

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

function ask (question) {
  return new Promise(resolve => rl.question(question, resolve))
}

async function main () {
  const apihost   = flags.apihost   || (await ask('API Host [https://adobeioruntime.net]: ')).trim() || 'https://adobeioruntime.net'
  const namespace = flags.namespace || (await ask('Namespace: ')).trim()
  const apiKey    = flags['api-key'] || (await ask('API Key: ')).trim()
  const type      = flags.type
  const size      = flags.size

  if (!namespace || !apiKey) {
    console.error('Namespace and API Key are required.')
    rl.close()
    process.exit(1)
  }

  const runtime = await init({ apihost, namespace, api_key: apiKey })

  console.log('\nCreating sandbox...')
  const sandbox = await runtime.compute.sandbox.create({
    region: 'us-east-1',
    name: 'my-sandbox',
    ...(type && { type }),
    ...(size && { size }),
    workspace: 'workspace',
    maxLifetime: 3600,
    envs: {}
  })
  console.log('Created:', sandbox.id)

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
