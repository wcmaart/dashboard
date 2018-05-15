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

  //  Get the domain we are going to be connected to
  req.templateValues.host = req.headers.host

  //  This is the cURL code for checking a developer token
  const curlCode = `curl \\
-H "Content-Type: application/json" \\
-H "Authorization: bearer ${global.config.handshake}" \\
-d '{"token": "${req.user.apitoken}"}' \\
-X POST http://${req.headers.host}/api/checkToken`

  const responseCode = `{
  "status":"ok",
  "msg":"Token found, valid for the number of seconds shown in expires_in",
  "expires_in":86400
}`

  const nodeCode = `const request = require('request')

const payload = {
  token: '${req.user.apitoken}'
}

request(
  {
    url: 'http://${req.headers.host}/api/checkToken',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: 'bearer ${global.config.handshake}'
    },
    json: payload
  },
  (error, resp, body) => {
    if (error) {
      console.log(error)
      // do something
    }
    if ('errors' in body) {
      console.log(body.errors)
      // do something else
    }
    console.log(body)
  }
)
`

  req.templateValues.curlCode = curlCode
  req.templateValues.responseCode = responseCode
  req.templateValues.nodeCode = nodeCode
  return res.render('config/index', req.templateValues)
}
