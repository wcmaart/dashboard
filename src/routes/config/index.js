const fs = require('fs')
const path = require('path')

const rootDir = __dirname

exports.index = (req, res) => {
  if (req.user.roles.isAdmin !== true) {
    return res.redirect('/')
  }

  //  Check to see if we've been passed a configuration option
  if ('action' in req.body) {
    let saveConfig = false
    if (req.body.action === 'updategraphql' && 'graphql' in req.body && req.body.graphql !== '') {
      global.config.graphql = {
        host: req.body.graphql
      }
      saveConfig = true
    }

    if (saveConfig === true) {
      const configFile = path.join(rootDir, '../../../', 'config.json')
      const configJSONPretty = JSON.stringify(global.config, null, 4)
      fs.writeFileSync(configFile, configJSONPretty, 'utf-8')
      return res.redirect('/config')
    }
  }
  return res.render('config/index', req.templateValues)
}
