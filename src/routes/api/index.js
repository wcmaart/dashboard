const request = require('request-promise')
const auth0 = require('../../modules/auth0')
const Config = require('../../classes/config')

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

exports.checkToken = async (req, res) => {
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
    return
  }

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
    return
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
    return
  }

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
  const auth0Token = await auth0.getAuth0Token()
  const qs = {
    fields: 'user_metadata',
    per_page: 100,
    search_engine: 'v2'
  }
  const foundToken = await request({
    url: `https://${auth0info.AUTH0_DOMAIN}/api/v2/users`,
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      Authorization: `bearer ${auth0Token}`
    },
    qs: qs
  })
    .then(response => {
      const token = JSON.parse(response).map((user) => {
        return user.user_metadata.apitoken
      }).filter((token) => {
        return token === req.body.token
      })
      return token.length === 1
    })
    .catch(error => {
      return [error]
    })

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