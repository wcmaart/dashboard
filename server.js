/*
 * Welcome to the server.js file, this file. This file is written in
 * ES6 and is expected to run in node.
 *
 * There is a lot of scripting at the top of this file, most of which
 * is to make sure the user has completed all the steps needed to
 * actually run the dashboard properly. This will be checking for
 * things like `yarn install` and the usual stuff having been run.
 *
 * You'll see!
 */
const fs = require('fs')
const path = require('path')

const rootDir = __dirname

//  Before we do anything else we need to check that the checking
console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
console.log('Making sure we are up to date, please wait...')
const spawnSync = require('child_process').spawnSync
const yarn = spawnSync('yarn', ['install'])
console.log(yarn.stdout.toString())

const colours = require('colors')
const prompt = require('prompt-sync')()

colours.setTheme({
  info: 'green',
  data: 'grey',
  help: 'cyan',
  warn: 'yellow',
  debug: 'blue',
  error: 'red',
  alert: 'magenta'
})

//  Let us know where the app is being run from
console.log(`server.js is being run from this directory: ${process.cwd()}`.help)
console.log(`server.js exists in this directory: ${rootDir}`.help)

/*
 * Check to see if the `.env` file exists, if not we need ask the user questions
 * to create it
 */

if (!fs.existsSync(path.join(rootDir, '.env'))) {
  console.log(
    'We need some first time information to get things up and running.'.info
  )
  process.stdout.write(`question `.data)
  let port = prompt('port number (4000): ')

  if (port === '') port = 4000
  port = parseInt(port)
  if (isNaN(port) || port < 0 || port > 49151) {
    console.log('Port must be between 0-49151, setting port to 4000'.alert)
    port = 4000
  }

  process.stdout.write(`question `.data)
  let nodeEnv = prompt(
    'NODE_ENV [development|staging|production] (development): '
  )
  if (nodeEnv === '') nodeEnv = 'development'

  const env = `# SERVER DATA
PORT=${port}
NODE_ENV=${nodeEnv}
`
  fs.writeFileSync(path.join(rootDir, '.env'), env, 'utf-8')
}

//  Now we can actually require it
require('dotenv').config()

console.log(process.env)
