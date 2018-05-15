const request = require('request-promise')
const auth0 = require('../auth0')

class Users {
  async get (role = null, page = 1, perPage = 50) {
    const auth0Token = await auth0.getAuth0Token()
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
