const Config = require('../../classes/config')

const fs = require('fs')
const path = require('path')
const rootDir = path.join(__dirname, '../../../data')
const logging = require('../logging')
const elasticsearch = require('elasticsearch')

/**
 * This method tries to grab a record of an object that has an image that needs
 * uploading and has a go at uploading, if it manages it then it puts the resulting
 * information back into the perfect file, otherwise it needs to mark it as failed
 * somehow
 * @param {String} stub The name of the TMS folder we are going to look in
 * @param {String} id The id of the object we want to upsert
 */
const upsertObject = async (stub, id) => {
  const tmsLogger = logging.getTMSLogger()

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
  //  And the matching perfect file
  const perfectFilename = path.join(rootDir, 'tms', stub, 'perfect', subFolder, `${id}.json`)
  if (!fs.existsSync(perfectFilename)) return

  //  Read in the processFile
  const processFileRaw = fs.readFileSync(processFilename, 'utf-8')
  const processFile = JSON.parse(processFileRaw)

  //  Read in the perfectFile
  const perfectFileRaw = fs.readFileSync(perfectFilename, 'utf-8')
  const perfectFile = JSON.parse(perfectFileRaw)

  const upsertItem = processFile
  upsertItem.tmsSource = perfectFile.tmsSource
  upsertItem.remote = perfectFile.remote
  upsertItem.source = stub

  const esclient = new elasticsearch.Client(elasticsearchConfig)
  const startTime = new Date().getTime()

  //  Create the index if we need to
  const index = 'objects_wcma'
  const type = 'object'
  const exists = await esclient.indices.exists({
    index
  })
  if (exists === false) {
    await esclient.indices.create({
      index
    })
  }

  //  Upsert the item
  esclient.update({
    index,
    type,
    id,
    body: {
      doc: upsertItem,
      doc_as_upsert: true
    }
  }).then(() => {
    //  Move it from the process to the processed folder
    const processedDir = path.join(rootDir, 'tms', stub, 'processed')
    if (!fs.existsSync(processedDir)) {
      fs.mkdirSync(processedDir)
    }
    if (!fs.existsSync(path.join(processedDir, subFolder))) {
      fs.mkdirSync(path.join(processedDir, subFolder))
    }
    const processedFilename = path.join(processedDir, subFolder, `${id}.json`)
    fs.renameSync(processFilename, processedFilename)
    const endTime = new Date().getTime()
    tmsLogger.object(`Upserted item for object ${id} for ${stub}`, {
      action: 'upsertedItem',
      id: id,
      stub: stub,
      ms: endTime - startTime
    })
  })
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
  tmsLogger.object(`Checking for a new items to upsert`, {
    action: 'checkingProcess'
  })
  tmsses.forEach((tms) => {
    if (foundItemToUpload === true) return
    //  Check to see if a 'process' directory exists
    const tmsDir = path.join(rootDir, 'tms', tms, 'process')
    const tmsPerfectDir = path.join(rootDir, 'tms', tms, 'perfect')
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
          //  Read in the perfect version of the file, because we want to see if the remote
          //  data has been set yet, or if it and the source is null, in either case we can upsert the
          //  file. Otherwise we are going to skip it.
          const perfectFileRaw = fs.readFileSync(path.join(tmsPerfectDir, subFolder, file), 'utf-8')
          const perfectFile = JSON.parse(perfectFileRaw)
          if ((perfectFile.tmsSource !== null && perfectFile.remote !== null) || (perfectFile.tmsSource === null && perfectFile.remote === null)) {
            foundItemToUpload = true
            upsertObject(tms, file.split('.')[0])
          }
        })
      })
    }
  })
  if (foundItemToUpload === false) {
    tmsLogger.object(`No new items found to upsert`, {
      action: 'checkingProcess'
    })
  }
}

const getImageForExhibition = (tms, ids) => {
  let remote = null
  const tmsDir = path.join(rootDir, 'tms')
  const perfectDir = path.join(tmsDir, tms, 'perfect')

  ids.forEach((id) => {
    if (remote === null) {
      const subFolder = String(Math.floor(id / 1000) * 1000)
      const perfectFilename = path.join(perfectDir, subFolder, `${id}.json`)
      if (fs.existsSync(perfectFilename)) {
        const perfectObjectRaw = fs.readFileSync(perfectFilename, 'utf-8')
        const perfectObject = JSON.parse(perfectObjectRaw)
        if ('remote' in perfectObject && perfectObject.remote !== null && 'status' in perfectObject.remote && perfectObject.remote.status === 'ok') {
          remote = perfectObject.remote
        }
      }
    }
  })
  return remote
}

const getImageForEvent = (tms, id) => {
  let remote = null
  const tmsDir = path.join(rootDir, 'tms')
  const perfectDir = path.join(tmsDir, tms, 'perfect')
  if (!isNaN(id)) {
    const subFolder = String(Math.floor(id / 1000) * 1000)
    const perfectFilename = path.join(perfectDir, subFolder, `${id}.json`)
    if (fs.existsSync(perfectFilename)) {
      const perfectObjectRaw = fs.readFileSync(perfectFilename, 'utf-8')
      const perfectObject = JSON.parse(perfectObjectRaw)
      if ('remote' in perfectObject && perfectObject.remote !== null && 'status' in perfectObject.remote && perfectObject.remote.status === 'ok') {
        remote = perfectObject.remote
      }
    }
  }

  return remote
}

/**
 * This method tries to grab a record of an object that has an image that needs
 * uploading and has a go at uploading, if it manages it then it puts the resulting
 * information back into the perfect file, otherwise it needs to mark it as failed
 * somehow
 * @param {String} stub The name of the TMS folder we are going to look in
 * @param {String} id The id of the object we want to upsert
 */
const upsertExhibition = async (stub, id) => {
  const tmsLogger = logging.getTMSLogger()

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
  const processFilename = path.join(rootDir, 'exhibitions', stub, 'process', subFolder, `${id}.json`)
  if (!fs.existsSync(processFilename)) return

  //  Read in the processFile
  const processFileRaw = fs.readFileSync(processFilename, 'utf-8')
  const processFile = JSON.parse(processFileRaw)

  const upsertExhibition = processFile
  upsertExhibition.source = stub

  //  Go and get a key image for the exhibition
  const keyImage = getImageForExhibition(stub, upsertExhibition.ExhObjXrefs)
  if (keyImage !== null) {
    upsertExhibition.keyImage = keyImage
  }

  const esclient = new elasticsearch.Client(elasticsearchConfig)
  const startTime = new Date().getTime()

  //  Create the index if we need to
  const index = 'exhibitions_wcma'
  const type = 'exhibition'
  const exists = await esclient.indices.exists({
    index
  })
  if (exists === false) {
    await esclient.indices.create({
      index
    })
  }

  //  Upsert the item
  esclient.update({
    index,
    type,
    id,
    body: {
      doc: upsertExhibition,
      doc_as_upsert: true
    }
  }).then(() => {
    //  Move it from the process to the processed folder
    const processedDir = path.join(rootDir, 'exhibitions', stub, 'processed')
    if (!fs.existsSync(processedDir)) {
      fs.mkdirSync(processedDir)
    }
    if (!fs.existsSync(path.join(processedDir, subFolder))) {
      fs.mkdirSync(path.join(processedDir, subFolder))
    }
    const processedFilename = path.join(processedDir, subFolder, `${id}.json`)
    fs.renameSync(processFilename, processedFilename)
    const endTime = new Date().getTime()
    tmsLogger.object(`Upserted item for exhibition ${id} for ${stub}`, {
      action: 'upsertedExhibition',
      id: id,
      stub: stub,
      ms: endTime - startTime
    })
  })
}

/**
 * All this method does is look through _all_ the tms "process" folders
 * looking for the first record it finds where we have an image source
 * defined in the perfect version of it, or the image source is null
 * @private
 */
const checkExhibitions = () => {
  const config = new Config()
  const elasticsearchConfig = config.get('elasticsearch')
  const tmsLogger = logging.getTMSLogger()

  //  If there's no elasticsearch configured then we don't bother
  //  to do anything
  if (elasticsearchConfig === null) {
    tmsLogger.object(`No elasticsearch configured`, {
      action: 'checkingEventsProcess'
    })
    return
  }

  //  Only carry on if we have a data and tms directory
  if (!fs.existsSync(rootDir) || !fs.existsSync(path.join(rootDir, 'exhibitions'))) {
    tmsLogger.object(`No data or data/exhibitions found`, {
      action: 'checkingExhibitionsProcess'
    })
    return
  }

  //  Now we need to look through all the folders in the tms/[something]/perfect/[number]
  //  folder looking for one that has an image that needs uploading, but hasn't been uploaded
  //  yet.
  let foundExhibitionsToUpload = false
  const tmsses = fs.readdirSync(path.join(rootDir, 'exhibitions'))
  tmsLogger.object(`Checking for a new exhibitions to upsert`, {
    action: 'checkingExhibitionsProcess'
  })
  tmsses.forEach((tms) => {
    if (foundExhibitionsToUpload === true) return
    //  Check to see if a 'process' directory exists
    const tmsDir = path.join(rootDir, 'exhibitions', tms, 'process')
    if (fs.existsSync(tmsDir)) {
      if (foundExhibitionsToUpload === true) return
      const subFolders = fs.readdirSync(tmsDir)
      subFolders.forEach((subFolder) => {
        if (foundExhibitionsToUpload === true) return
        const files = fs.readdirSync(path.join(tmsDir, subFolder)).filter(file => {
          const fileFragments = file.split('.')
          if (fileFragments.length !== 2) return false
          if (fileFragments[1] !== 'json') return false
          return true
        })
        files.forEach((file) => {
          if (foundExhibitionsToUpload === true) return
          foundExhibitionsToUpload = true
          upsertExhibition(tms, file.split('.')[0])
        })
      })
    }
  })
  if (foundExhibitionsToUpload === false) {
    tmsLogger.object(`No new exhibitions found to upsert`, {
      action: 'checkingExhibitionProcess'
    })
  }
}

/**
 * This method tries to grab a record of an object that has an image that needs
 * uploading and has a go at uploading, if it manages it then it puts the resulting
 * information back into the perfect file, otherwise it needs to mark it as failed
 * somehow
 * @param {String} stub The name of the TMS folder we are going to look in
 * @param {String} id The id of the object we want to upsert
 */
const upsertEvent = async (stub, id) => {
  const tmsLogger = logging.getTMSLogger()

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
  const processFilename = path.join(rootDir, 'events', stub, 'process', subFolder, `${id}.json`)
  if (!fs.existsSync(processFilename)) return

  //  Read in the processFile
  const processFileRaw = fs.readFileSync(processFilename, 'utf-8')
  const processFile = JSON.parse(processFileRaw)

  const upsertEvent = processFile
  upsertEvent.source = stub

  //  Convert some strings to numbers
  upsertEvent.eventId = parseInt(upsertEvent.eventId, 10)
  upsertEvent.courseNbr = parseInt(upsertEvent.courseNbr, 10)
  upsertEvent.startYear = parseInt(upsertEvent.startYear, 10)
  upsertEvent.startMonth = parseInt(upsertEvent.startMonth, 10)
  upsertEvent.startDay = parseInt(upsertEvent.startDay, 10)
  upsertEvent.objectID = parseInt(upsertEvent.objectID, 10)

  if (isNaN(upsertEvent.courseNbr)) upsertEvent.courseNbr = null
  if (isNaN(upsertEvent.startYear)) upsertEvent.startYear = null
  if (isNaN(upsertEvent.startMonth)) upsertEvent.startMonth = null
  if (isNaN(upsertEvent.startDay)) upsertEvent.startDay = null
  upsertEvent.startDateDate = null
  try {
    upsertEvent.startDateDate = new Date(upsertEvent.startDate)
  } catch (er) {}

  const d = upsertEvent.startDateDate
  if ((d instanceof Date && !isNaN(d)) === false) {
    delete upsertEvent.startDateDate
  }

  const sd = upsertEvent.startDate
  if ((sd instanceof Date && !isNaN(sd)) === false) {
    delete upsertEvent.startDate
  }

  //  Go and get a key image for the event
  const keyImage = getImageForEvent(stub, parseInt(upsertEvent.objectID, 10))
  if (keyImage !== null) {
    upsertEvent.keyImage = keyImage
  }

  const esclient = new elasticsearch.Client(elasticsearchConfig)
  const startTime = new Date().getTime()

  //  Create the index if we need to
  const index = 'events_wcma'
  const type = 'event'
  const exists = await esclient.indices.exists({
    index
  })
  if (exists === false) {
    await esclient.indices.create({
      index
    })
  }

  //  Upsert the item
  esclient.update({
    index,
    type,
    id,
    body: {
      doc: upsertEvent,
      doc_as_upsert: true
    }
  }).then(() => {
    //  Move it from the process to the processed folder
    const processedDir = path.join(rootDir, 'events', stub, 'processed')
    if (!fs.existsSync(processedDir)) {
      fs.mkdirSync(processedDir)
    }
    if (!fs.existsSync(path.join(processedDir, subFolder))) {
      fs.mkdirSync(path.join(processedDir, subFolder))
    }
    const processedFilename = path.join(processedDir, subFolder, `${id}.json`)
    fs.renameSync(processFilename, processedFilename)
    const endTime = new Date().getTime()
    tmsLogger.object(`Upserted item for event ${id} for ${stub}`, {
      action: 'upsertedEvent',
      id: id,
      stub: stub,
      ms: endTime - startTime
    })
  })
}

/**
 * All this method does is look through _all_ the tms "process" folders
 * looking for the first record it finds where we have an image source
 * defined in the perfect version of it, or the image source is null
 * @private
 */
const checkEvents = () => {
  const config = new Config()
  const elasticsearchConfig = config.get('elasticsearch')
  const tmsLogger = logging.getTMSLogger()

  //  If there's no elasticsearch configured then we don't bother
  //  to do anything
  if (elasticsearchConfig === null) {
    tmsLogger.object(`No elasticsearch configured`, {
      action: 'checkingEventsProcess'
    })
    return
  }

  //  Only carry on if we have a data and tms directory
  if (!fs.existsSync(rootDir) || !fs.existsSync(path.join(rootDir, 'events'))) {
    tmsLogger.object(`No data or data/events found`, {
      action: 'checkingEventsProcess'
    })
    return
  }

  //  Now we need to look through all the folders in the tms/[something]/perfect/[number]
  //  folder looking for one that has an image that needs uploading, but hasn't been uploaded
  //  yet.
  let foundEventsToUpload = false
  const tmsses = fs.readdirSync(path.join(rootDir, 'events'))
  tmsLogger.object(`Checking for a new events to upsert`, {
    action: 'checkingEventsProcess'
  })
  tmsses.forEach((tms) => {
    if (foundEventsToUpload === true) return
    //  Check to see if a 'process' directory exists
    const tmsDir = path.join(rootDir, 'events', tms, 'process')
    if (fs.existsSync(tmsDir)) {
      if (foundEventsToUpload === true) return
      const subFolders = fs.readdirSync(tmsDir)
      subFolders.forEach((subFolder) => {
        if (foundEventsToUpload === true) return
        const files = fs.readdirSync(path.join(tmsDir, subFolder)).filter(file => {
          const fileFragments = file.split('.')
          if (fileFragments.length !== 2) return false
          if (fileFragments[1] !== 'json') return false
          return true
        })
        files.forEach((file) => {
          if (foundEventsToUpload === true) return
          foundEventsToUpload = true
          upsertEvent(tms, file.split('.')[0])
        })
      })
    }
  })
  if (foundEventsToUpload === false) {
    tmsLogger.object(`No new events found to upsert`, {
      action: 'checkingEventProcess'
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

exports.startUpsertingEvents = () => {
  //  Remove the old interval timer
  clearInterval(global.elasticsearchEventsTmr)

  //  See if we have an interval timer setting in the
  //  timers part of the config, if not use the default
  //  of 20,000 (20 seconds)
  const config = new Config()
  const timers = config.get('timers')
  let interval = 20000
  if (timers !== null && 'elasticsearch' in timers) {
    interval = parseInt(timers.elasticsearch, 10)
  }
  global.elasticsearchEventsTmr = setInterval(() => {
    checkEvents()
  }, interval)
  checkEvents()
}

exports.startUpsertingExhibitions = () => {
  //  Remove the old interval timer
  clearInterval(global.elasticsearchExhibitionsTmr)

  //  See if we have an interval timer setting in the
  //  timers part of the config, if not use the default
  //  of 20,000 (20 seconds)
  const config = new Config()
  const timers = config.get('timers')
  let interval = 20000
  if (timers !== null && 'elasticsearch' in timers) {
    interval = parseInt(timers.elasticsearch, 10)
  }
  global.elasticsearchExhibitionsTmr = setInterval(() => {
    checkExhibitions()
  }, interval)
  checkExhibitions()
}
