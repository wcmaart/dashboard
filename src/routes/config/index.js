const Config = require('../../classes/config')

exports.index = (req, res) => {
  if (req.user.roles.isAdmin !== true) {
    return res.redirect('/')
  }

  //  Check to see if we've been passed a configuration option
  if ('action' in req.body) {
    const config = new Config()

    if (req.body.action === 'updategraphql' && 'graphql' in req.body && req.body.graphql !== '') {
      config.set('graphql', {
        host: req.body.graphql
      })
      const pingtools = require('../../modules/pingtools')
      pingtools.pingGraphQL()
      return res.redirect('/config')
    }
  }

  //  Get the domain we are going to be connected to
  req.templateValues.host = req.headers.host

  return res.render('config/index', req.templateValues)
}
