const request = require('request-promise')
class Queries {
  constructor () {
    this.hello = `query {
      hello[[]] {
        there
      }
    }`
  }

  get (query, filter) {
    if (!(query in this)) return null
    return this[query].replace('[[]]', filter)
  }

  async fetch (payload) {
    return request({
      url: `${global.config.graphql.host}/graphql`,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `bearer ${global.config.handshake}`
      },
      json: payload
    })
      .then(response => {
        return response
      })
      .catch(error => {
        return [error]
      })
  }
}
module.exports = Queries
