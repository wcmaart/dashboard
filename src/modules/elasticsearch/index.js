const Config = require('../../classes/config')

const fs = require('fs')
const path = require('path')
const rootDir = path.join(__dirname, '../../../data')
const logging = require('../logging')

/**
 * This method tries to grab a record of an object that has an image that needs
 * uploading and has a go at uploading, if it manages it then it puts the resulting
 * information back into the perfect file, otherwise it needs to mark it as failed
 * somehow
 * @param {String} stub The name of the TMS folder we are going to look in
 * @param {String} id The id of the object we want to upsert
 */
const upsertObject = (stub, id) => {
  // const tmsLogger = logging.getTMSLogger()

  //  Check to see that we have elasticsearch configured
  const config = new Config()
  const elasticsearchConfig = config.get('elasticsearch')
  //  If there's no elasticsearch configured then we don't bother
  //  to do anything
  if (elasticsearchConfig === null) {
    return
  }

  //  Check to make sure the file exists
  const subFolder = String(Math.floor(id / 1000) * 1000)
  const processFilename = path.join(rootDir, 'tms', stub, 'process', subFolder, `${id}.json`)
  if (!fs.existsSync(processFilename)) return

  //  Read in the perfectFile
  const processFileRaw = fs.readFileSync(processFilename, 'utf-8')
  const processFile = JSON.parse(processFileRaw)

  console.log('This is the file we are going to process')
  console.log(processFile)
}

/**
 * All this method does is look through _all_ the tms "process" folders
 * looking for the first record it finds where we have an image source
 * defined in the perfect version of it, or the image source is null
 * @private
 */
const checkItems = () => {
  const config = new Config()
  const elasticsearchConfig = config.get('elasticsearch')
  const tmsLogger = logging.getTMSLogger()

  //  If there's no elasticsearch configured then we don't bother
  //  to do anything
  if (elasticsearchConfig === null) {
    tmsLogger.object(`No elasticsearch configured`, {
      action: 'checkingProcess'
    })
    return
  }

  //  Only carry on if we have a data and tms directory
  if (!fs.existsSync(rootDir) || !fs.existsSync(path.join(rootDir, 'tms'))) {
    tmsLogger.object(`No data or data/tms found`, {
      action: 'checkingProcess'
    })
    return
  }

  //  Now we need to look through all the folders in the tms/[something]/perfect/[number]
  //  folder looking for one that has an image that needs uploading, but hasn't been uploaded
  //  yet.
  let foundItemToUpload = false
  const tmsses = fs.readdirSync(path.join(rootDir, 'tms'))
  /*
  tmsLogger.object(`Checking for a new items to upload`, {
    action: 'checkingProcess'
  })
  */
  tmsses.forEach((tms) => {
    if (foundItemToUpload === true) return
    //  Check to see if a 'process' directory exists
    const tmsDir = path.join(rootDir, 'tms', tms, 'process')
    if (fs.existsSync(tmsDir)) {
      if (foundItemToUpload === true) return
      const subFolders = fs.readdirSync(tmsDir)
      subFolders.forEach((subFolder) => {
        if (foundItemToUpload === true) return
        const files = fs.readdirSync(path.join(tmsDir, subFolder)).filter(file => {
          const fileFragments = file.split('.')
          if (fileFragments.length !== 2) return false
          if (fileFragments[1] !== 'json') return false
          return true
        })
        files.forEach((file) => {
          if (foundItemToUpload === true) return
          // const processFileRaw = fs.readFileSync(path.join(tmsDir, subFolder, file), 'utf-8')
          // const processFile = JSON.parse(processFileRaw)
          /*
          if (perfectFile.tmsSource !== null && perfectFile.remote === null) {
            foundImageToUpload = true
            upsertObject(tms, file.split('.')[0])
          }
          */
          foundItemToUpload = true
          upsertObject(tms, file.split('.')[0])
        })
      })
    }
  })
  if (foundItemToUpload === false) {
    tmsLogger.object(`No new items found to upload`, {
      action: 'checkingProcess'
    })
  }
}

exports.startUpserting = () => {
  //  Remove the old interval timer
  clearInterval(global.elasticsearchTmr)

  //  See if we have an interval timer setting in the
  //  timers part of the config, if not use the default
  //  of 20,000 (20 seconds)
  const config = new Config()
  const timers = config.get('timers')
  let interval = 20000
  if (timers !== null && 'elasticsearch' in timers) {
    interval = parseInt(timers.elasticsearch, 10)
  }
  global.elasticsearchTmr = setInterval(() => {
    checkItems()
  }, interval)
  checkItems()
}
