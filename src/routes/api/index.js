const fs = require('fs')
const path = require('path')
const Config = require('../../classes/config')
const elasticsearch = require('elasticsearch')

const rootDir = path.join(__dirname, '../../..')

exports.index = (req, res) => {
  if (req.user.roles.isAdmin !== true && req.user.roles.isStaff !== true) {
    return res.redirect('/')
  }

  const config = new Config()
  if (config.get('handshake') === null) {
    return res.redirect('/')
  }
  //  This is the cURL code for checking a developer token
  const curlCode = `curl \\
-H "Content-Type: application/json" \\
-H "Authorization: bearer ${config.get('handshake')}" \\
-d '{"token": "${req.user.apitoken}"}' \\
-X POST http://${req.headers.host}/api/checkToken`

  const responseCode = `{
  "status":"ok",
  "msg":"Token found, valid for the number of seconds shown in expires_in",
  "expires_in":86400
}`

  const nodeCode = `const request = require('request')

const payload = {
  token: '${req.user.apitoken}'
}

request(
  {
    url: 'http://${req.headers.host}/api/checkToken',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: 'bearer ${config.get('handshake')}'
    },
    json: payload
  },
  (error, resp, body) => {
    if (error) {
      console.log(error)
      // do something
    }
    if ('errors' in body) {
      console.log(body.errors)
      // do something else
    }
    console.log(body)
  }
)
`

  req.templateValues.host = req.headers.host
  req.templateValues.curlCode = curlCode
  req.templateValues.responseCode = responseCode
  req.templateValues.nodeCode = nodeCode
  return res.render('api/index', req.templateValues)
}

const validate = async (req, res) => {
  const config = new Config()

  //  Check we have a handshake token against which to check
  if (config.get('handshake') === null) {
    const error = {
      status: 'error',
      msg: `The API has not been set up yet`
    }
    res.setHeader('Content-Type', 'application/json')
    res.status(500)
    res.send(JSON.stringify(error))
    return false
  }

  //  We need to make sure we have an Authorization token
  //  Check to see if we've been passed an authorization token
  if (!('headers' in req) || !('authorization' in req.headers)) {
    const error = {
      status: 'error',
      msg: `You need to provide an authorization bearer token, please visit the config section of the dashboard for more information`
    }
    res.setHeader('Content-Type', 'application/json')
    res.status(401)
    res.send(JSON.stringify(error))
    return false
  }

  //  See if the bearer token matches our handshake token
  const authSplit = req.headers.authorization.split(' ')
  if (authSplit.length !== 2 || authSplit[0].toLowerCase() !== 'bearer' || authSplit[1] !== config.get('handshake')) {
    const error = {
      status: 'error',
      msg: `Incorrect authorization token`
    }
    res.setHeader('Content-Type', 'application/json')
    res.status(401)
    res.send(JSON.stringify(error))
    return false
  }

  return true
}

exports.checkToken = async (req, res) => {
  //  Check to see if we have a valid call
  const isValid = await validate(req, res)
  if (isValid === false) {
    return
  }

  const config = new Config()

  //  Check to see if we've been passed a token to check
  if (!('body' in req) || !('token' in req.body)) {
    const error = {
      status: 'error',
      msg: `You need to provide a token to check`
    }
    res.setHeader('Content-Type', 'application/json')
    res.status(401)
    res.send(JSON.stringify(error))
    return
  }

  const auth0info = config.get('auth0')
  if (auth0info === null) {
    const error = {
      status: 'error',
      msg: `auth0 is not set up`
    }
    res.setHeader('Content-Type', 'application/json')
    res.status(401)
    res.send(JSON.stringify(error))
    return
  }

  //  Now we know everything is valid, we can test to see if the token exists
  let foundToken = false
  const filename = path.join(rootDir, 'data', 'tokens.json')
  if (fs.existsSync(filename)) {
    const tokensRaw = fs.readFileSync(filename, 'utf-8')
    const tokensJSON = JSON.parse(tokensRaw)
    //  If we have a record of the token, then it's valid
    if (req.body.token in tokensJSON.valid) {
      foundToken = true
    }
    //  Unless of course it's not
    if (req.body.token in tokensJSON.rejected) {
      foundToken = false
    }
  }

  if (foundToken !== true) {
    const error = {
      status: 'error',
      msg: `Token not found, valid for the number of seconds shown in expires_in`,
      expires_in: (60 * 20 * 1)
    }
    res.setHeader('Content-Type', 'application/json')
    res.status(401)
    res.send(JSON.stringify(error))
    return
  }

  const rtnJSON = {
    status: 'ok',
    msg: `Token found, valid for the number of seconds shown in expires_in`,
    expires_in: (60 * 60 * 24)
  }
  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(rtnJSON))
}

const noElasticSearch = (res) => {
  const error = {
    status: 'error',
    msg: `ElasticSearch is not set up`
  }
  res.setHeader('Content-Type', 'application/json')
  res.status(401)
  return res.send(JSON.stringify(error))
}

const getPage = (query) => {
  const defaultPage = 0
  if ('page' in query) {
    try {
      const page = parseInt(query.page, 10)
      if (page < 0) {
        return defaultPage
      }
      return page
    } catch (er) {
      return defaultPage
    }
  }
  return defaultPage
}

const getPerPage = (query) => {
  const defaultPerPage = 50
  if ('per_page' in query) {
    try {
      const perPage = parseInt(query.per_page, 10)
      if (perPage < 0) {
        return defaultPerPage
      }
      return perPage
    } catch (er) {
      return defaultPerPage
    }
  }
  return defaultPerPage
}

exports.getObjects = async (req, res) => {
  const config = new Config()

  //  Grab the elastic search config details
  const elasticsearchConfig = config.get('elasticsearch')
  if (elasticsearchConfig === null) {
    return noElasticSearch(res)
  }

  //  Set up the client
  const esclient = new elasticsearch.Client(elasticsearchConfig)
  const index = 'objects_wcma'
  const page = getPage(req.query)
  const perPage = getPerPage(req.query)
  const body = {
    from: page * perPage,
    size: perPage
  }

  //  Sigh, very bad way to add filters
  //  NOTE: This doesn't combine filters
  if ('type' in req.query && req.query.type !== '') {
    body.query = {
      match: {
        object_name: {
          query: req.query.type
        }
      }
    }
  }

  if ('maker' in req.query && req.query.maker !== '') {
    body.query = {
      match: {
        maker: {
          query: req.query.maker
        }
      }
    }
  }

  if ('period' in req.query && req.query.period !== '') {
    body.query = {
      match: {
        period: {
          query: req.query.period
        }
      }
    }
  }

  if ('material' in req.query && req.query.material !== '') {
    body.query = {
      match: {
        medium: {
          query: req.query.material
        }
      }
    }
  }

  const records = await esclient.search({
    index,
    body
  }).catch((err) => {
    console.error(err)
  })
  let objects = []
  if (records !== undefined && records !== null && 'hits' in records) {
    objects = records.hits.hits.map((object) => {
      return object._source
    })
  }

  const rtnJSON = {
    status: 'ok',
    msg: `Hello world`,
    results: objects
  }
  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(rtnJSON))
}

exports.getObject = async (req, res) => {
  const config = new Config()

  //  Grab the elastic search config details
  const elasticsearchConfig = config.get('elasticsearch')
  if (elasticsearchConfig === null) {
    return noElasticSearch(res)
  }

  //  Set up the client
  const esclient = new elasticsearch.Client(elasticsearchConfig)
  const index = 'objects_wcma'
  const type = 'object'

  if (!('id' in req.query)) {
    const error = {
      status: 'error',
      msg: `You need to pass in an 'id' parameter`
    }
    res.setHeader('Content-Type', 'application/json')
    res.status(401)
    res.send(JSON.stringify(error))
    return
  }

  const object = await esclient.get({
    index,
    type,
    id: req.query.id
  }).catch((err) => {
    console.error(err)
  })
  let objects = []
  if (object !== undefined && object !== null && 'found' in object && object.found === true) {
    objects = [object._source]
  }

  const rtnJSON = {
    status: 'ok',
    msg: `Hello world`,
    objects
  }
  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(rtnJSON))
}

const getUniques = async (index, type, query, res) => {
  const config = new Config()

  //  Grab the elastic search config details
  const elasticsearchConfig = config.get('elasticsearch')
  if (elasticsearchConfig === null) {
    return noElasticSearch(res)
  }

  //  Set up the client
  const esclient = new elasticsearch.Client(elasticsearchConfig)
  const page = getPage(query)
  const perPage = getPerPage(query)
  const records = await esclient.search({
    index,
    type,
    body: {
      from: page * perPage,
      size: perPage,
      sort: [{
        count: {
          order: 'desc'
        }
      }]
    }
  }).catch((err) => {
    console.error(err)
  })
  let results = []
  if (records !== undefined && records !== null && 'hits' in records) {
    results = records.hits.hits.map((object) => {
      return object._source
    })
  }
  return results
}

exports.getObjectTypes = async (req, res) => {
  const results = await getUniques('object_types_wcma', 'object_type', req.query, res)
  if (!(Array.isArray(results))) {
    return results
  }
  const rtnJSON = {
    status: 'ok',
    index: `object_types_wcma`,
    type: `object_type`,
    results: results
  }
  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(rtnJSON))
}

exports.getMakers = async (req, res) => {
  const results = await getUniques('object_makers_wcma', 'object_makers', req.query, res)
  if (!(Array.isArray(results))) {
    return results
  }
  const rtnJSON = {
    status: 'ok',
    index: `object_makers_wcma`,
    type: `object_makers`,
    results: results
  }
  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(rtnJSON))
}

exports.getPeriods = async (req, res) => {
  const results = await getUniques('object_periods_wcma', 'object_period', req.query, res)
  if (!(Array.isArray(results))) {
    return results
  }
  const rtnJSON = {
    status: 'ok',
    index: `object_periods_wcma`,
    type: `object_period`,
    results: results
  }
  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(rtnJSON))
}

exports.getMaterials = async (req, res) => {
  const results = await getUniques('object_materials_wcma', 'object_materials', req.query, res)
  if (!(Array.isArray(results))) {
    return results
  }
  const rtnJSON = {
    status: 'ok',
    index: `object_materials_wcma`,
    type: `object_materials`,
    results: results
  }
  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(rtnJSON))
}
