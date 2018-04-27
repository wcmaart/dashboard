const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')

// Break out all the seperate parts of the site
/* eslint-disable import/no-unresolved */
const main = require('./main')

/*
 * Always create a templateValues object that gets passed to the
 * templates. The config object from global (this allows use to
 * manipulate it here if we need to) and the user if one exists
 */
router.use(function (req, res, next) {
  req.templateValues = {}
  req.config = global.config
  req.user = null

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
        return res.redirect('/')
      }
    }

    //  If not, check to see if we've been passed a handshake
    if ('handshake' in req.query) {
      req.templateValues.handshake = req.query.handshake
    }

    //  Set up a nice handy default callback if we are developing
    if (process.env.NODE_ENV === 'development') {
      req.templateValues.callbackUrl = `${process.env.HOST}:${process.env.PORT}/callback`
    }
    req.templateValues.NODE_ENV = process.env.NODE_ENV
    return res.render('config/auth0', req.templateValues)
  }
  next()
})

router.get('/', main.index)

module.exports = router
