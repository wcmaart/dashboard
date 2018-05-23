const Config = require('../../classes/config')

const fs = require('fs')
const path = require('path')
const rootDir = path.join(__dirname, '../../../data')
const cloudinary = require('cloudinary')
const logging = require('../logging')

/**
 * This method tries to grab a record of an object that has an image that needs
 * uploading and has a go at uploading, if it manages it then it puts the resulting
 * information back into the perfect file, otherwise it needs to mark it as failed
 * somehow
 * @param {String} stub The name of the TMS folder we are going to look in
 * @param {String} id The id of the object we want to upload
 */
const uploadImage = (stub, id) => {
  const tmsLogger = logging.getTMSLogger()

  //  Check to see that we have cloudinary configured
  const config = new Config()
  const cloudinaryConfig = config.get('cloudinary')
  //  If there's no cloudinary configured then we don't bother
  //  to do anything
  if (cloudinaryConfig === null) {
    return
  }

  //  Check to make sure the file exists
  const subFolder = String(Math.floor(id / 1000) * 1000)
  const filename = path.join(rootDir, 'tms', stub, 'perfect', subFolder, `${id}.json`)
  if (!fs.existsSync(filename)) return

  //  Read in the perfectFile
  const perfectFileRaw = fs.readFileSync(filename, 'utf-8')
  const perfectFile = JSON.parse(perfectFileRaw)

  //  Grab the url for this tms system based on the stub
  const tmsses = config.get('tms').filter((tms) => {
    if (stub === tms.stub) return true
    return false
  }).map((tms) => {
    return tms.url
  })
  if (tmsses.length !== 1) return

  //  Swap the tumbnail version of the image url for the preview url
  const previewUrl = perfectFile.tmsSource.split('/')
  previewUrl.pop()
  const imageID = previewUrl.pop()
  const url = `${tmsses[0]}/apis/iiif/image/v2/${imageID}/full/full/0/default.jpg`
  //  Set up cloudinary
  cloudinary.config(cloudinaryConfig)

  const startTime = new Date().getTime()
  tmsLogger.object(`Uploading image for object ${id} for ${stub}`, {
    action: 'uploadImage',
    id: id,
    stub: stub,
    source: url
  })

  cloudinary.uploader.upload(url, (result) => {
    //  Check to see if we had an error, if so we add that to the perfect file
    //  instead, so maybe we can go back and retry them
    const endTime = new Date().getTime()
    if ('error' in result) {
      perfectFile.remote = {
        status: 'error',
        message: result.error.message,
        http_code: result.error.https_code
      }
      tmsLogger.object(`Failed uploading image for object ${id} for ${stub}`, {
        action: 'error',
        id: id,
        stub: stub,
        source: url,
        ms: endTime - startTime,
        error: result
      })
    } else {
      tmsLogger.object(`Uploaded image for object ${id} for ${stub}`, {
        action: 'uploadedImage',
        id: id,
        stub: stub,
        source: url,
        ms: endTime - startTime
      })
      perfectFile.remote = {
        status: 'ok',
        original_image_id: imageID,
        public_id: result.public_id,
        version: result.version,
        signature: result.signature,
        width: result.width,
        height: result.height,
        format: result.format
      }
    }
    const perfectFileJSONPretty = JSON.stringify(perfectFile, null, 4)
    fs.writeFileSync(filename, perfectFileJSONPretty, 'utf-8')
  })
}

/**
 * All this method does is look through _all_ the tms "perfect" folders
 * looking for the first record it finds where we have an image source
 * but the remote is still 'null' meaning we haven't uploaded it yet.
 * As soon as we find one we stop (kind of, forEach loops just keep going)
 * and call the 'uploadImage' method to actually handle the uploading of it
 * @private
 */
const checkImages = () => {
  const config = new Config()
  const cloudinaryConfig = config.get('cloudinary')
  const tmsLogger = logging.getTMSLogger()

  //  If there's no cloudinary configured then we don't bother
  //  to do anything
  if (cloudinaryConfig === null) {
    tmsLogger.object(`No cloudinary configured`, {
      action: 'checkingImages'
    })
    return
  }

  //  Only carry on if we have a data and tms directory
  if (!fs.existsSync(rootDir) || !fs.existsSync(path.join(rootDir, 'tms'))) {
    tmsLogger.object(`No data or data/tms found`, {
      action: 'checkingImages'
    })
    return
  }

  //  Now we need to look through all the folders in the tms/[something]/perfect/[number]
  //  folder looking for one that has an image that needs uploading, but hasn't been uploaded
  //  yet.
  let foundImageToUpload = false
  const tmsses = fs.readdirSync(path.join(rootDir, 'tms'))
  tmsLogger.object(`Checking for a new image to upload`, {
    action: 'checkingImages'
  })
  tmsses.forEach((tms) => {
    if (foundImageToUpload === true) return
    //  Check to see if a 'perfect' directory exists
    const tmsDir = path.join(rootDir, 'tms', tms, 'perfect')
    if (fs.existsSync(tmsDir)) {
      if (foundImageToUpload === true) return
      const subFolders = fs.readdirSync(tmsDir)
      subFolders.forEach((subFolder) => {
        if (foundImageToUpload === true) return
        const files = fs.readdirSync(path.join(tmsDir, subFolder)).filter(file => {
          const fileFragments = file.split('.')
          if (fileFragments.length !== 2) return false
          if (fileFragments[1] !== 'json') return false
          return true
        })
        files.forEach((file) => {
          if (foundImageToUpload === true) return
          const perfectFileRaw = fs.readFileSync(path.join(tmsDir, subFolder, file), 'utf-8')
          const perfectFile = JSON.parse(perfectFileRaw)
          if (perfectFile.tmsSource !== null && perfectFile.remote === null) {
            foundImageToUpload = true
            uploadImage(tms, file.split('.')[0])
          }
        })
      })
    }
  })
  if (foundImageToUpload === false) {
    tmsLogger.object(`No new images found to upload`, {
      action: 'checkingImages'
    })
  }
}

exports.startUploading = () => {
  setInterval(() => {
    checkImages()
  }, 1000 * 20)
  checkImages()
}
