const Config = require('../../classes/config')
const fs = require('fs')
const path = require('path')
const LineByLineReader = require('line-by-line')

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
      thisTMS.totalFiles = totalFiles
      thisTMS.haveImageSources = haveImageSources
      thisTMS.imagesUploaded = imagesUploaded

      let waitingToBeProcessed = 0
      const processDir = path.join(rootDir, 'tms', tms.stub, 'process')
      if (fs.existsSync(processDir)) {
        const subFolders = fs.readdirSync(perfectDir)
        subFolders.forEach((subFolder) => {
          const jsonFiles = fs.readdirSync(path.join(processDir, subFolder)).filter((file) => {
            const filesSplit = file.split('.')
            if (filesSplit.length !== 2) return false
            if (filesSplit[1] !== 'json') return false
            return true
          })
          waitingToBeProcessed += jsonFiles.length
        })
      }
      thisTMS.waitingToBeProcessed = waitingToBeProcessed

      const endTime = new Date().getTime()
      thisTMS.ms = endTime - startTime
      newTMS.push(thisTMS)
    })
  }
  req.templateValues.tms = newTMS
  return res.render('stats/index', req.templateValues)
}

exports.logs = (req, res) => {
  if (req.user.roles.isAdmin !== true && req.user.roles.isStaff !== true) {
    return res.redirect('/')
  }

  //  Check to see if we have log files
  const rootDir = path.join(__dirname, '../../../logs/tms')
  if (!fs.existsSync(rootDir)) {
    return res.render('stats/logs', req.templateValues)
  }
  const logs = fs.readdirSync(rootDir).filter((file) => {
    const fileSplit = file.split('.')
    if (fileSplit.length !== 2) return false
    if (fileSplit[1] !== 'log') return false
    return true
  })
  const lastLog = logs.pop()

  //  Now we want to get the 100 most recent
  const last100Lines = []
  const last100ImagesUploaded = []
  const last100PagesReceived = []

  const lr = new LineByLineReader(path.join(rootDir, lastLog))
  lr.on('line', function (line) {
    //  Split the line and get the data
    const lineSplit = line.split(' [object]: ')
    const timestamp = new Date(lineSplit[0])
    const data = JSON.parse(lineSplit[1])
    const logEntry = {
      timestamp: timestamp,
      data: data
    }

    //  we record all the entries here
    last100Lines.push(logEntry)
    if (last100Lines.length > 100) {
      last100Lines.shift()
    }

    //  Now we save the uploaded images here
    if ('action' in data && data.action === 'uploadedImage') {
      last100ImagesUploaded.push(logEntry)
      if (last100ImagesUploaded.length > 100) {
        last100ImagesUploaded.shift()
      }
    }

    //  Now we save the pages recieved
    if ('action' in data && data.action === 'received') {
      last100PagesReceived.push(logEntry)
      if (last100PagesReceived.length > 100) {
        last100PagesReceived.shift()
      }
    }
  })
  lr.on('end', function () {
    req.templateValues.last100Lines = last100Lines.reverse()

    //  Get the total ms spent uploading the images
    const imagesUploadms = last100ImagesUploaded.map((record) => {
      return parseInt(record.data.ms, 10)
    })
    //  Get the average time to upload an image
    req.templateValues.averageImageUploadms = Math.floor(imagesUploadms.reduce((p, c) => p + c, 0) / imagesUploadms.length)
    req.templateValues.last100ImagesUploaded = last100ImagesUploaded.reverse()

    //  Get the total ms spent uploading the images
    const pagesReceivedms = last100PagesReceived.map((record) => {
      return parseInt(record.data.ms, 10)
    })
    //  Get the average time to upload an image
    req.templateValues.averagePagesReceivedms = Math.floor(pagesReceivedms.reduce((p, c) => p + c, 0) / pagesReceivedms.length)
    req.templateValues.last100PagesReceived = last100PagesReceived.reverse()

    return res.render('stats/logs', req.templateValues)
  })
}
