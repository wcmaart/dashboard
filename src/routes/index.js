const express = require('express')
const router = express.Router()

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
  next()
})

router.get('/', main.index)

module.exports = router
