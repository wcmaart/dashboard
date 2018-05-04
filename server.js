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
 * Check to see if we have been passed in command line parameters to define
 * the port, host, environment and if we want to skip any build steps
 */
const argOptionDefinitions = [
  { name: 'port', alias: 'p', type: Number },
  { name: 'host', alias: 'h', type: String },
  { name: 'env', alias: 'e', type: String },
  { name: 'skipBuild', alias: 's', type: Boolean, defaultOption: false }
]
const commandLineArgs = require('command-line-args')
const argOptions = commandLineArgs(argOptionDefinitions)

if ('port' in argOptions || 'host' in argOptions || 'env' in argOptions) {
  let port = 4002
  let host = 'localhost'
  let nodeEnv = 'development'
  if ('port' in argOptions) port = argOptions.port
  if ('host' in argOptions) host = argOptions.host
  if ('env' in argOptions) nodeEnv = argOptions.env
  const env = `# SERVER DATA
PORT=${port}
HOST=${host}
NODE_ENV=${nodeEnv}
`
  fs.writeFileSync(path.join(rootDir, '.env'), env, 'utf-8')
}

//  Here we are managing if we are going to skip the build step
//  we'll want to do that if we are forcing a restart of the app.
//  We force a restart if we detect files changing, but only on
//  dev. We will need to set a flag to tell the difference between
//  a forced exit we want and a crash
let skipBuild = false
global.doRestart = false
if ('skipBuild' in argOptions && argOptions.skipBuild === true) {
  skipBuild = true
}

/*
 * Check to see if the `.env` file exists, if not we need ask the user questions
 * to create it
 */

if (!fs.existsSync(path.join(rootDir, '.env'))) {
  console.log(
    'We need some first time information to get things up and running.'.info
  )

  process.stdout.write(`question `.data)
  let port = prompt('port number (4002): ')

  if (port === '') port = 4002
  port = parseInt(port)
  if (isNaN(port) || port < 0 || port > 49151) {
    console.log('Port must be between 0-49151, setting port to 4002'.alert)
    port = 4002
  }

  process.stdout.write(`question `.data)
  let host = prompt('host (localhost): ')

  if (host === '') host = 'localhost'

  process.stdout.write(`question `.data)
  let nodeEnv = prompt(
    'NODE_ENV [development|staging|production] (development): '
  )
  if (nodeEnv === '') nodeEnv = 'development'

  const env = `# SERVER DATA
PORT=${port}
HOST=${host}
NODE_ENV=${nodeEnv}
`
  fs.writeFileSync(path.join(rootDir, '.env'), env, 'utf-8')
}

//  Now we can actually require it
require('dotenv').config()

//  We will also check for a config file, if there isn't one, we'll create
//  it
const configFile = path.join(rootDir, 'config.json')
if (!fs.existsSync(configFile)) {
  const crypto = require('crypto')
  const handshake = crypto
    .createHash('md5')
    .update(`${Math.random()}`)
    .digest('hex')

  const config = {
    handshake: handshake
  }

  const configJSONPretty = JSON.stringify(config, null, 4)
  fs.writeFileSync(configFile, configJSONPretty, 'utf-8')
}

// ########################################################################
/*
 * STEP TWO
 *
 * We need to show the user a webpage, for this to work we need to make
 * sure the code is build, the CSS is compiled and the templates copied
 * over.
 *
 * We will build, compile and copy each time the service starts
 *
 */

if (skipBuild === false) {
  // Copy template files
  spawnSync('npx', [
    'babel',
    'src/templates',
    '--out-dir',
    'app/templates',
    '--copy-files'
  ])

  //  Compile node files
  spawnSync('npx', ['babel', 'src', '--out-dir', 'app'])

  // Copy template files
  spawnSync('npx', [
    'babel',
    'src/public/images',
    '--out-dir',
    'app/public/images',
    '--copy-files'
  ])

  //  Compile node files
  spawnSync('npx', ['babel', 'src', '--out-dir', 'app'])

  //  Copy over all the png, xml and ico files for the icons that sit in
  //  the public dir
  const moveFiles = fs
    .readdirSync(path.join(rootDir, '/src/public'))
    .filter(file => {
      return file.split('.').length > 1
    })
    .filter(file => {
      let extension = file.split('.')
      extension = extension.pop()
      return ['png', 'xml', 'ico', 'json'].includes(extension)
    })
  moveFiles.forEach(file => {
    const source = path.join(rootDir, '/src/public', file)
    const target = path.join(rootDir, '/app/public', file)
    fs.copyFileSync(source, target)
  })
}

// ########################################################################
/*
 * STEP THREE
 *
 * Compile the CSS
 *
 */

if (skipBuild === false) {
  if (!fs.existsSync(path.join(rootDir, '/app/public'))) {
    fs.mkdirSync(path.join(rootDir, '/app/public'))
  }
  if (!fs.existsSync(path.join(rootDir, '/app/public/css'))) {
    fs.mkdirSync(path.join(rootDir, '/app/public/css'))
  }
  const sass = require('node-sass')
  let sassResult = ''
  if (process.env.NODE_ENV === 'development') {
    sassResult = sass.renderSync({
      file: path.join(rootDir, '/src/sass/main.scss'),
      outputStyle: 'compact',
      outFile: path.join(rootDir, '/app/public/css/main.css'),
      sourceMap: true
    })
    fs.writeFileSync(
      path.join(rootDir, '/app/public/css/main.css.map'),
      sassResult.map
    )
  } else {
    sassResult = sass.renderSync({
      file: path.join(rootDir, '/src/sass/main.scss'),
      outputStyle: 'compressed'
    })
  }
  fs.writeFileSync(
    path.join(rootDir, '/app/public/css/main.css'),
    sassResult.css
  )
}

// ########################################################################
/*
 * STEP FOUR (optional)
 *
 * If we are in developement mode we want to watch for file changes that
 * mean we need to either recompile source code which requires a restart
 * of the server. Or recompile CSS or copy over new html/public files
 * both of which don't require a server restart.
 *
 * Bonus, we want to try and _only_ recompile/copy over changed or new
 * files
 *
 */
if (process.env.NODE_ENV === 'development') {
  const devtools = require('./app/modules/devtools')
  devtools.watcher()
}

// ########################################################################
/*
 * STEP FIVE
 *
 * Now we have enough for our server to actually run on a port we need
 * to check to see if a config.json file exist, which is going to actually
 * hold all the other information.
 *
 * Specifically in this case the Auth0 settings as we are now running
 * the server on we assume either localhost _or_ a public website.
 * Because Auth0 should be protecting us from all the admin stuff and
 * initially that isn't in place we need to somehow project the Auth0
 * form. We'll do this by creating a local token which has to be added
 * to be able to update the form. The user installing this app will know
 * the token becasue we'll tell them. But a remote user won't have that
 * information.
 * */

const express = require('express')
const exphbs = require('express-handlebars')
const routes = require('./app/routes')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const session = require('express-session')
const FileStore = require('session-file-store')(session)
const http = require('http')
const helpers = require('./app/helpers')
const passport = require('passport')
const Auth0Strategy = require('passport-auth0')

//  Read in the config file
const configRaw = fs.readFileSync(configFile, 'utf-8')
global.config = JSON.parse(configRaw)

const app = express()
const hbs = exphbs.create({
  extname: '.html',
  helpers,
  partialsDir: `${__dirname}/app/templates/includes/`
})

app.engine('html', hbs.engine)
app.set('view engine', 'html')
app.set('views', `${__dirname}/app/templates`)
app.use(
  express.static(`${__dirname}/app/public`, {
    'no-cache': true
  })
)
app.use(bodyParser.json())
app.use(
  bodyParser.urlencoded({
    extended: true
  })
)
app.use(cookieParser())
app.use(
  session({
    // Here we are creating a unique session identifier
    secret: global.config.handshake,
    resave: true,
    saveUninitialized: true,
    store: new FileStore({
      ttl: 60 * 60 * 24 * 7
    })
  })
)

if ('auth0' in global.config) {
  // Configure Passport to use Auth0
  const strategy = new Auth0Strategy(
    {
      domain: global.config.auth0.AUTH0_DOMAIN,
      clientID: global.config.auth0.AUTH0_CLIENT_ID,
      clientSecret: global.config.auth0.AUTH0_SECRET,
      callbackURL: global.config.auth0.AUTH0_CALLBACK_URL
    },
    (accessToken, refreshToken, extraParams, profile, done) => {
      return done(null, profile)
    }
  )

  passport.use(strategy)

  // This can be used to keep a smaller payload
  passport.serializeUser(function (user, done) {
    done(null, user)
  })

  passport.deserializeUser(function (user, done) {
    done(null, user)
  })

  app.use(passport.initialize())
  app.use(passport.session())
}

app.use('/', routes)

app.use((request, response) => {
  response.status(404).render('static/404')
})

if (process.env.NODE_ENV !== 'DEV') {
  app.use((err, req, res) => {
    console.error(err.stack)
    res.status(500).send('Something broke!')
  })
}

//  Check to see if the old pid is active, if so we kill it
const pidFile = path.join(rootDir, '.pid')
if (fs.existsSync(pidFile)) {
  const pid = fs.readFileSync(pidFile, 'utf-8')
  console.log('old pid: ', pid)
  const isRunning = require('is-running')(pid)
  if (isRunning) {
    process.kill(pid)
  }
}

fs.writeFileSync(pidFile, process.pid, 'utf-8')

//  If we are on the dev server and we aren't restarting with a
//  build skip, then start up a browser to get the user going.
//  If we don't have any Auth0 stuff in place yet we also need
//  to pass over the handshake value so we can do a quick
//  basic authentication.
if (process.env.NODE_ENV === 'development') {
  if (skipBuild === false) {
    const opn = require('opn')
    // If there is no auth0 entry in the config file then we need
    // to pass over the handshake value
    if (!('auth0' in global.config)) {
      opn(
        `http://${process.env.HOST}:${process.env.PORT}?handshake=${global.config.handshake}`
      )
    } else {
      opn(`http://${process.env.HOST}:${process.env.PORT}`)
    }
  }
  console.log(`>> Connect to: ${process.env.HOST}:${process.env.PORT}`.alert)
} else {
  console.log(
    `
>> Welcome to the Dashboard, please visit the site however you have your host and ports setup to see it from the outside world`
      .info
  )
  if (!('auth0' in global.config)) {
    console.log(
      `>> You will be asked for a 'handshake' code while setting up the next step, please use the following value
      `.info
    )
    console.log(global.config.handshake.bold.warn)
    console.log('')
    console.log(
      '>> You can also find the value in the '.info +
        'config.json'.bold.data +
        ' file'.info
    )
    console.log('')
  }
}

http.createServer(app).listen(process.env.PORT)
