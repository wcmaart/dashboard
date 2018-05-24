const Queries = require('../../classes/queries')
const GraphQL = require('../../classes/graphQL')
const Config = require('../../classes/config')
const Elasticsearch = require('elasticsearch')

const pingGraphQL = async () => {
  const ping = {}

  const queries = new Queries()
  const graphQL = new GraphQL()
  const payload = {
    query: queries.get('hello', '')
  }
  const startms = new Date().getTime()
  const results = await graphQL.fetch(payload)
  const endms = new Date().getTime()
  ping.ms = endms - startms
  ping.timestamp = endms
  //  If we got an array back, it means we had an error
  //  and we should count that as a miss, otherwise assume
  //  all is good
  if (Array.isArray(results)) {
    ping.valid = false
  } else {
    ping.valid = true
  }

  //  Pop the updated information into the global array. Note
  //  to start with this will clear out each time we refresh
  //  the server, which _shouldn't_ be so much of a problem when
  //  the system goes live, as we're not planning on restarting
  //  it that often anyway. And it isn't that critical if we don't
  //  have that much data anyway
  if (!('graphqlping' in global)) {
    global.graphqlping = []
  }
  global.graphqlping.unshift(ping)
  global.graphqlping = global.graphqlping.slice(0, 30)
}
exports.pingGraphQL = pingGraphQL

exports.startPingingGraphQL = () => {
  //  Ping GrahpQL
  global.pingGraphQLTmr = setInterval(() => {
    pingGraphQL()
  }, 60 * 1000)
  pingGraphQL()
}

/**
 * This pings elastic search to see if it's up
 * @return {null/number} Null if no connection, milliseconds if we did
 */
const pingES = async () => {
  const config = new Config()
  const startTime = new Date().getTime()
  const elasticsearchJSON = config.get('elasticsearch')

  let worked = false
  if (elasticsearchJSON !== null) {
    //  We want to add error suppression to the client so it doesn't throw
    //  errors (which sometimes will) on the ping test. We want to know the
    //  response is 'null', we don't need all the error messages in our logs
    //  TODO: actually we may want the errors in logs and we should change the
    //  `type` to be a log file rather than console
    const client = elasticsearchJSON
    client.log = [{
      type: 'stdio',
      levels: []
    }]
    const esclient = new Elasticsearch.Client(client)
    try {
      worked = await esclient.ping()
    } catch (er) {
      worked = false
    }
  }
  const endTime = new Date().getTime()
  const ping = {
    ms: endTime - startTime,
    timestamp: endTime,
    valid: worked
  }

  if (!('elasticsearchping' in global)) {
    global.elasticsearchping = []
  }
  global.elasticsearchping.unshift(ping)
  global.elasticsearchping = global.elasticsearchping.slice(0, 30)
}
exports.pingES = pingES
exports.startPingingES = () => {
  //  Ping GrahpQL
  global.pingESTmr = setInterval(() => {
    pingES()
  }, 60 * 1000)
  pingES()
}
