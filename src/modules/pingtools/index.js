const pingGraphQL = () => {
  console.log('Ping GraphQL')
}

exports.startPinging = () => {
  //  Ping GrahpQL
  global.pingGraphQLTmr = setTimeout(() => {
    pingGraphQL()
  }, 60 * 1000)
  pingGraphQL()
}