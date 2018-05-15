const request = require('request-promise')

/** Class allowing us to connect to a GraphQL server. */
class GraphQL {
  /**
   *
   * @param {json} payload The query and any other options to be sent to the GraphQL server
   * @returns {json|Array} The results from GraphQL as a json objects, or an array containing the error if the query failed
   */
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
module.exports = GraphQL
