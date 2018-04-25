const express = require('express')
const router = express.Router()

// Break out all the seperate parts of the site
/* eslint-disable import/no-unresolved */
const main = require('./main')

router.get('/', main.index)

module.exports = router
