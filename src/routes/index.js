const express = require('express')
const passport = require('passport')
const router = express.Router()
const fs = require('fs')
const path = require('path')
const User = require('../classes/user')
const ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn()

// Break out all the seperate parts of the site
/* eslint-disable import/no-unresolved */
const admin = require('./admin')
const api = require('./api')
const main = require('./main')
const config = require('./config')
const developer = require('./developer')
const user = require('./user')

// ############################################################################
//
/*
 * Always create a templateValues object that gets passed to the
 * templates. The config object from global (this allows use to
 * manipulate it here if we need to) and the user if one exists
 */
//
// ############################################################################
router.use(function (req, res, next) {
  req.templateValues = {}
  req.config = global.config
  req.templateValues.config = req.config
  req.templateValues.NODE_ENV = process.env.NODE_ENV
  if (req.user === undefined) {
    req.user = null
  } else {
    //  Shortcut the roles
    if ('user_metadata' in req.user && 'roles' in req.user.user_metadata) {
      req.user.roles = req.user.user_metadata.roles
      req.user.apitoken = req.user.user_metadata.apitoken
    } else {
      req.user.roles = {
        isAdmin: false,
        isDeveloper: false,
        isStaff: false
      }
    }
  }
  req.templateValues.user = req.user

  //  If there is no Auth0 setting in config then we _must_
  //  check to see if we are setting Auth0 settings and if
  //  not, redirect to the Auth0 form.
  if (!('auth0' in req.config)) {
    // Check to see if values are being posted to us
    if (req.method === 'POST') {
      if (
        'action' in req.body &&
        'AUTH0_DOMAIN' in req.body &&
        'AUTH0_CLIENT_ID' in req.body &&
        'AUTH0_SECRET' in req.body &&
        'AUTH0_CALLBACK_URL' in req.body &&
        'handshake' in req.body &&
        req.body.action === 'save' &&
        req.body.handshake === global.config.handshake
      ) {
        global.config.auth0 = {
          AUTH0_DOMAIN: req.body.AUTH0_DOMAIN,
          AUTH0_CLIENT_ID: req.body.AUTH0_CLIENT_ID,
          AUTH0_SECRET: req.body.AUTH0_SECRET,
          AUTH0_CALLBACK_URL: req.body.AUTH0_CALLBACK_URL
        }
        const rootDir = __dirname
        const configFile = path.join(rootDir, '../../config.json')
        const configJSONPretty = JSON.stringify(global.config, null, 4)
        fs.writeFileSync(configFile, configJSONPretty, 'utf-8')
        setTimeout(() => {
          global.doRestart = true
          process.exit()
        }, 500)
        return res.redirect('/wait')
      }
    }

    //  If not, check to see if we've been passed a handshake
    if ('handshake' in req.query) {
      req.templateValues.handshake = req.query.handshake
    }

    //  Set up a nice handy default callback if we are developing
    if (process.env.NODE_ENV === 'development') {
      req.templateValues.callbackUrl = `http://${process.env.HOST}:${process.env.PORT}/callback`
    }
    req.templateValues.NODE_ENV = process.env.NODE_ENV
    return res.render('config/auth0', req.templateValues)
  }
  next()
})

// ############################################################################
//
//  Here are all the main routes
//
// ############################################################################

router.get('/', main.index)
router.get('/admin', ensureLoggedIn, admin.index)
router.get('/admin/users', ensureLoggedIn, admin.users)
router.get('/admin/user/:id', ensureLoggedIn, admin.user)
router.post('/admin/user/:id', ensureLoggedIn, admin.user)
router.get('/config', ensureLoggedIn, config.index)
router.post('/config', ensureLoggedIn, config.index)
router.get('/developer', ensureLoggedIn, developer.index)
router.get('/developer/graphql', ensureLoggedIn, developer.graphql)
router.get('/developer/graphql/status', ensureLoggedIn, developer.status.graphql)
router.get('/settings', ensureLoggedIn, user.settings)
router.get('/wait', main.wait)

router.get('/api', ensureLoggedIn, api.index)
router.post('/api/checkToken', api.checkToken)

// ############################################################################
//
//  Log in and log out tools
//
// ############################################################################

const rootDir = __dirname
const configFile = path.join(rootDir, '../../config.json')

if (fs.existsSync(configFile)) {
  const configRaw = fs.readFileSync(configFile, 'utf-8')
  global.config = JSON.parse(configRaw)
  if ('auth0' in global.config) {
    router.get(
      '/login',
      passport.authenticate('auth0', {
        clientID: global.config.auth0.AUTH0_CLIENT_ID,
        domain: global.config.auth0.AUTH0_DOMAIN,
        redirectUri: global.config.auth0.AUTH0_CALLBACK_URL,
        audience: 'https://' + global.config.auth0.AUTH0_DOMAIN + '/userinfo',
        responseType: 'code',
        scope: 'openid profile'
      }),
      function (req, res) {
        res.redirect('/')
      }
    )

    // Perform session logout and redirect to homepage
    router.get('/logout', (req, res) => {
      req.logout()
      res.redirect('/')
    })

    // Perform the final stage of authentication and redirect to '/user'
    router.get(
      '/callback',
      passport.authenticate('auth0', {
        failureRedirect: '/'
      }),
      async function (req, res) {
        //  Update the user with extra information
        req.session.passport.user = await new User().get(req.user)
        res.redirect(req.session.returnTo || '/')
      }
    )
  }
}

module.exports = router
