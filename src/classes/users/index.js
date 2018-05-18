const request = require('request-promise')
const auth0 = require('../../modules/auth0')
const Config = require('../config')

class Users {
  async get (role = null, page = 1, perPage = 50) {
    const auth0Token = await auth0.getAuth0Token()
    const payload = {}

    const config = new Config()
    const auth0info = config.get('auth0')
    if (auth0info === null) {
      return ['error', 'No auth0 set in config']
    }

    const users = await request({
      url: `https://${auth0info.AUTH0_DOMAIN}/api/v2/users`,
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
