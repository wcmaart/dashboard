const request = require('request-promise')
const auth0 = require('../../modules/auth0')

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

  //  Check we have a handshake token against which to check
  if (!('config' in global) || !('handshake' in global.config)) {
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
  if (authSplit.length !== 2 || authSplit[0].toLowerCase() !== 'bearer' || authSplit[1] !== global.config.handshake) {
    const error = {
      status: 'error',
      msg: `Incorrect authorization token`
    }
    res.setHeader('Content-Type', 'application/json')
    res.status(401)
    res.send(JSON.stringify(error))
    return
  }

  if (!('config' in global) || !('handshake' in global.config)) {
    const error = {
      status: 'error',
      msg: `The API has not been set up yet`
    }
    res.setHeader('Content-Type', 'application/json')
    res.status(500)
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

  //  Now we know everything is valid, we can test to see if the token exists
  const auth0Token = await auth0.getAuth0Token()
  const qs = {
    fields: 'user_metadata',
    per_page: 100,
    search_engine: 'v2'
  }
  const foundToken = await request({
    url: `https://${global.config.auth0.AUTH0_DOMAIN}/api/v2/users`,
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
      msg: `Token not found`
    }
    res.setHeader('Content-Type', 'application/json')
    res.status(401)
    res.send(JSON.stringify(error))
    return
  }

  const rtnJSON = {
    status: 'ok',
    msg: `Token found`
  }
  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(rtnJSON))
}

/* Example asking for a token
curl -H "Content-Type: application/json" -H "Authorization: bearer 6c36dcd96d6346ac6d376d9d7742366f" -d '{"token": "7f4aca5f014348fef67943bc54f3cbce"}' -X POST http://localhost:4002/api/checkToken
*/
