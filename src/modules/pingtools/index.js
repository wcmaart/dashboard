const Queries = require('../queries')

const pingGraphQL = async () => {
  const ping = {}

  if ('graphql' in global.config) {
    const queries = new Queries()
    const payload = {
      query: queries.get('hello', '')
    }
    const startms = new Date().getTime()
    const results = await queries.fetch(payload)
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
  } else {
    ping.ms = 0
    ping.timestamp = new Date().getTime()
    ping.valid = false
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

exports.startPinging = () => {
  //  Ping GrahpQL
  global.pingGraphQLTmr = setInterval(() => {
    pingGraphQL()
  }, 60 * 1000)
  pingGraphQL()
}
