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

    if (req.body.action === 'updatetms' && 'tmsstub' in req.body && req.body.tmsstub !== '' && 'tmsurl' in req.body && req.body.tmsurl !== '' && 'key' in req.body && req.body.key !== '') {
      //  If there's no TMS entry in config, then we create it
      if (config.get('tms') === null) {
        config.set('tms', [])
      }
      //  Now get the config again
      const tms = config.get('tms')
      //  Loop through them seeing if we already have an entry, if so update it
      let foundMatch = false
      tms.forEach((thisTMS) => {
        if (thisTMS.stub === req.body.tmsstub) {
          thisTMS.url = req.body.tmsurl
          thisTMS.key = req.body.key
          foundMatch = true
        }
      })
      if (foundMatch === false) {
        tms.push({
          stub: req.body.tmsstub,
          url: req.body.tmsurl,
          key: req.body.key
        })
      }
      config.set('tms', tms)
      return res.redirect('/config')
    }

    if (req.body.action === 'deletetms' && 'tmsstub' in req.body && req.body.tmsstub !== '') {
      const tms = config.get('tms')
      if (tms !== null) {
        const newtms = tms.filter((thisTMS) => {
          return thisTMS.stub !== req.body.tmsstub
        })
        config.set('tms', newtms)
        return res.redirect('/config')
      }
    }
  }

  //  Get the domain we are going to be connected to
  req.templateValues.host = req.headers.host

  return res.render('config/index', req.templateValues)
}