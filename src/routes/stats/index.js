const Config = require('../../classes/config')
const fs = require('fs')
const path = require('path')

exports.index = (req, res) => {
  if (req.user.roles.isAdmin !== true && req.user.roles.isStaff !== true) {
    return res.redirect('/')
  }

  //  Just for fun we are going to find out how many perfect records we
  //  have for each TMS system, see how many have images and how many
  //  images have been uploaded
  const rootDir = path.join(__dirname, '../../../data')
  const config = new Config()
  const tmsses = config.get('tms')
  const newTMS = []

  if (tmsses !== null) {
    tmsses.forEach((tms) => {
      const thisTMS = {
        stub: tms.stub
      }
      const startTime = new Date().getTime()
      let totalFiles = 0
      let haveImageSources = 0
      let imagesUploaded = 0
      const perfectDir = path.join(rootDir, 'tms', tms.stub, 'perfect')
      if (fs.existsSync(perfectDir)) {
        const subFolders = fs.readdirSync(perfectDir)
        subFolders.forEach((subFolder) => {
          const jsonFiles = fs.readdirSync(path.join(perfectDir, subFolder)).filter((file) => {
            const filesSplit = file.split('.')
            if (filesSplit.length !== 2) return false
            if (filesSplit[1] !== 'json') return false
            return true
          })
          jsonFiles.forEach((file) => {
            const filename = path.join(perfectDir, subFolder, file)
            const fileRaw = fs.readFileSync(filename, 'utf-8')
            const fileJSON = JSON.parse(fileRaw)
            totalFiles += 1
            if ('tmsSource' in fileJSON && fileJSON.tmsSource !== null) {
              haveImageSources += 1
              if ('remote' in fileJSON && fileJSON.remote !== null) {
                imagesUploaded += 1
              }
            }
          })
        })
      }
      const endTime = new Date().getTime()
      thisTMS.ms = endTime - startTime
      thisTMS.totalFiles = totalFiles
      thisTMS.haveImageSources = haveImageSources
      thisTMS.imagesUploaded = imagesUploaded
      newTMS.push(thisTMS)
    })
  }
  req.templateValues.tms = newTMS
  return res.render('stats/index', req.templateValues)
}
