const request = require('request-promise')

/*
 *  This goes and gets us the token we need to make further API calls
 *  TODO: We will store this token so we don't need to keep refreshing
 *  it, we'll stick it in `global` along with the expire time, and only
 *  re-fetch if we don't have a token, or it's expired.
 */
const getAuth0Token = async () => {
  var options = {
    method: 'POST',
    url: `https://${global.config.auth0.AUTH0_DOMAIN}/oauth/token`,
    headers: { 'content-type': 'application/json' },
    body: {
      grant_type: 'client_credentials',
      client_id: global.config.auth0.AUTH0_CLIENT_ID,
      client_secret: global.config.auth0.AUTH0_SECRET,
      audience: `https://${global.config.auth0.AUTH0_DOMAIN}/api/v2/`
    },
    json: true
  }

  const auth0Token = await request(options)
    .then(response => {
      return response.access_token
    })
    .catch(error => {
      return [error]
    })
  return auth0Token
}

class Users {
  async get (role = null, page = 1, perPage = 50) {
    const auth0Token = await getAuth0Token()
    const payload = {}
    const users = await request({
      url: `https://${global.config.auth0.AUTH0_DOMAIN}/api/v2/users`,
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        Authorization: `bearer ${auth0Token}`
      },
      json: payload
    })
      .then(response => {
        return response
      })
      .catch(error => {
        return [error]
      })
    return users
  }
}
module.exports = Users
