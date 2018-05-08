exports.index = (req, res) => {
  return res.render('developer/index', req.templateValues)
}

exports.graphql = (req, res) => {
  return res.render('developer/graphql', req.templateValues)
}

exports.status = {
  graphql: (req, res) => {
    req.templateValues.graphqlping = global.graphqlping
    return res.render('developer/status/graphql', req.templateValues)
  }
}
