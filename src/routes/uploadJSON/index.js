const Config = require('../../classes/config')
const formidable = require('formidable')
const fs = require('fs')

exports.index = (req, res) => {
  if (req.user.roles.isAdmin !== true && req.user.roles.isStaff !== true) {
    return res.redirect('/')
  }

  const config = new Config()

  //  Check to see if we've been passed a configuration option
  if ('action' in req.body) {

  }

  return res.render('uploadJSON/index', req.templateValues)
}

exports.getfile = (req, res) => {
  if (req.user.roles.isAdmin !== true && req.user.roles.isStaff !== true) {
    return res.redirect('/')
  }

  const config = new Config()
  const form = new formidable.IncomingForm()
  let tms = null
  form.parse(req, (err, fields, files) => {
    //  If there was an error, let the user know
    if (err) {
      req.templateValues.error = {
        msg: 'An error occured when uploaded the file.'
      }
      return res.render('uploadJSON/index', req.templateValues)
    }

    //  Make sure the tms we have been passed is valid
    const tmsses = config.get('tms').map((tms) => {
      return tms.stub
    })
    if (!('tms' in fields) || tmsses.includes(fields.tms) === false) {
      req.templateValues.error = {
        msg: 'Sorry, an invalid TMS system was passed in, please try again.'
      }
      return res.render('uploadJSON/index', req.templateValues)
    }
    tms = fields.tms
  })

  form.on('file', (name, file) => {
    //  TODO: Check what type of XML file we have been passed, we will do this
    //  based on the 'action' field. And will then validate (as best we can)
    //  the contents of the file based on what we've been passed
    if (name === 'objectJSON') {
      const objectsRAW = fs.readFileSync(file.path, 'utf-8')
      //  Add try catch here
      const objectsJSON = JSON.parse(objectsRAW)
    }

    return res.render('uploadJSON/index', req.templateValues)
  })
}
