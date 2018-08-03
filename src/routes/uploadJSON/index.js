const Config = require('../../classes/config')
const formidable = require('formidable')
const fs = require('fs')
const path = require('path')
const rootDir = path.join(__dirname, '../../../data')
const logging = require('../../modules/logging')

exports.index = (req, res) => {
  if (req.user.roles.isAdmin !== true && req.user.roles.isStaff !== true) {
    return res.redirect('/')
  }

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

  const tmsLogger = logging.getTMSLogger()

  form.parse(req, (err, fields, files) => {
    //  If there was an error, let the user know
    if (err) {
      req.templateValues.error = {
        msg: 'An error occured when uploaded the file.'
      }
      tmsLogger.object(`An error occured when uploaded a JSON file`, {
        action: 'error',
        err: err
      })
      return res.render('uploadJSON/results', req.templateValues)
    }

    //  Make sure the tms we have been passed is valid
    const tmsses = config.get('tms').map((tms) => {
      return tms.stub
    })
    if (!('tms' in fields) || tmsses.includes(fields.tms) === false) {
      req.templateValues.error = {
        msg: 'Sorry, an invalid TMS system was passed in, please try again.'
      }
      tmsLogger.object(`Invalid TMS system passed in when uploading JSON file`, {
        action: 'error',
        stub: fields.tms
      })
      return res.render('uploadJSON/results', req.templateValues)
    }

    const tms = fields.tms

    if ('objectJSON' in files) {
      processObjectJSON(req, res, tms, files.objectJSON.path)
    }

    if ('eventsJSON' in files) {
      processEventsJSON(req, res, tms, files.eventsJSON.path)
    }

    if ('exhibitionsJSON' in files) {
      processExhibitionsJSON(req, res, tms, files.exhibitionsJSON.path)
    }
  })
}

const processObjectJSON = (req, res, tms, filename) => {
  //  TODO: Check what type of XML file we have been passed, we will do this
  //  based on the 'action' field. And will then validate (as best we can)
  //  the contents of the file based on what we've been passed
  let newObjects = 0
  let modifiedObjects = 0
  let totalObjects = 0
  const startTime = new Date().getTime()
  const tmsLogger = logging.getTMSLogger()

  let objectsRAW = fs.readFileSync(filename, 'utf-8')
  //  We are being given some "JSON" like JSON which isn't actually JSON
  //  until we remove a whole bunch of special characters, like so...
  //  Get rid of curly apostrophes (we may need to do this for curly quotes too)
  objectsRAW = objectsRAW.replace(/’/g, '\'')
  //  Now the rest of the special characters
  objectsRAW = objectsRAW.replace(/[^\x20-\x7E]/g, '')

  //  Add try catch here
  let objectsJSON = null
  try {
    objectsJSON = JSON.parse(objectsRAW)
  } catch (er) {
    req.templateValues.error = {
      msg: 'Sorry, we failed to parse that JSON file, please try again.'
    }
    tmsLogger.object(`Failed to parse that JSON file tms ${tms}`, {
      action: 'error',
      stub: tms
    })
    return res.render('uploadJSON/results', req.templateValues)
  }

  tmsLogger.object(`New objectJSON uploaded for tms ${tms}`, {
    action: 'upload',
    stub: tms
  })

  /* ##########################################################################

  This is where the PROCESSING STARTS

  ########################################################################## */

  //  Make sure they are correct
  objectsJSON = objectsJSON.filter((object) => {
    return ('accession_number' in object)
  })

  //  In theory we now have a valid(ish) objects file. Let's go through
  //  it now and work out how many objects are new or modified
  objectsJSON.forEach((object) => {
    totalObjects += 1
    const id = parseInt(object.id, 10)
    const subFolder = String(Math.floor(id / 1000) * 1000)
    const filename = path.join(rootDir, 'tms', tms, 'processed', subFolder, `${id}.json`)

    //  See if the files exists in processed, if it doesn't then it's a new file
    let needToUpload = false
    if (!fs.existsSync(filename)) {
      tmsLogger.object(`Creating process file for object ${id} for ${tms}`, {
        action: 'new',
        id: id,
        stub: tms
      })
      newObjects += 1
      needToUpload = true
    } else {
      //  We need to read in the file and compare to see if it's different
      const processedFileRaw = fs.readFileSync(filename, 'utf-8')
      const processedFile = JSON.stringify(JSON.parse(processedFileRaw))
      const thisObject = JSON.stringify(object)
      //  If there's a difference between the objects then we know it's been modified
      //  and we need to upload it.
      if (thisObject !== processedFile) {
        needToUpload = true
        modifiedObjects += 1
        //  Remove it from the processed fold, to force us to reupload it
        fs.unlinkSync(filename)
        tmsLogger.object(`Found changed object JSON for object ${id} for ${tms}`, {
          action: 'modified',
          id: id,
          stub: tms
        })
      }
    }

    //  If we need to upload the file then pop it into the process folder
    if (needToUpload === true) {
      if (!fs.existsSync(path.join(rootDir, 'tms', tms, 'process'))) {
        fs.mkdirSync(path.join(rootDir, 'tms', tms, 'process'))
      }
      if (!fs.existsSync(path.join(rootDir, 'tms', tms, 'process', subFolder))) {
        fs.mkdirSync(path.join(rootDir, 'tms', tms, 'process', subFolder))
      }
      const newFilename = path.join(rootDir, 'tms', tms, 'process', subFolder, `${id}.json`)
      const processedFileJSONPretty = JSON.stringify(object, null, 4)
      fs.writeFileSync(newFilename, processedFileJSONPretty, 'utf-8')
    }
  })

  /* ##########################################################################

  This is where the PROCESSING ENDS

  ########################################################################## */

  //  As a seperate thing, I want to see all the fields that exist
  //  and let us know if we've found any new ones

  //  Check to see if we already have a file containing all the fields, if so read it in
  let objectFields = []
  const objectsFieldsFilename = path.join(rootDir, 'tms', tms, 'objectFields.json')
  if (fs.existsSync(objectsFieldsFilename)) {
    objectFields = fs.readFileSync(objectsFieldsFilename, 'utf-8')
    objectFields = JSON.parse(objectFields)
  }
  const objectFieldsMap = {}

  //  Now go through all the objects looking at all the keys
  //  checking to see if we already have a record of them, if so
  //  mark them as new
  objectsJSON.forEach((object) => {
    Object.keys(object).forEach((key) => {
      //  If we don't have a record, then add it to the fields
      if (!objectFields.includes(key)) {
        objectFields.push(key)
        //  If we don't already have it in the fields, then it's
        //  all new
        if (!(key in objectFieldsMap)) {
          objectFieldsMap[key] = true
        }
      } else {
        //  If we don't have it, then we need to add it to the map
        //  but it's not new as it already exists in the array
        if (!(key in objectFieldsMap)) {
          objectFieldsMap[key] = false
        }
      }
    })
  })

  //  Now write the fields back out so we can compare against them next time
  const objectFieldsJSONPretty = JSON.stringify(objectFields, null, 4)
  fs.writeFileSync(objectsFieldsFilename, objectFieldsJSONPretty, 'utf-8')
  req.templateValues.fields = objectFieldsMap

  const endTime = new Date().getTime()
  tmsLogger.object(`Finished uploading object JSON file for object ${tms}`, {
    action: 'finished',
    stub: tms,
    newObjects: newObjects,
    modifiedObjects: modifiedObjects,
    totalObjects: totalObjects,
    ms: endTime - startTime
  })
  req.templateValues.type = 'objects'
  req.templateValues.newObjects = newObjects
  req.templateValues.modifiedObjects = modifiedObjects
  req.templateValues.totalObjects = totalObjects
  return res.render('uploadJSON/results', req.templateValues)
}

const processEventsJSON = (req, res, tms, filename) => {
  //  TODO: Check what type of XML file we have been passed, we will do this
  //  based on the 'action' field. And will then validate (as best we can)
  //  the contents of the file based on what we've been passed
  let newEvents = 0
  let modifiedEvents = 0
  let totalEvents = 0
  const startTime = new Date().getTime()
  const tmsLogger = logging.getTMSLogger()

  let eventsRAW = fs.readFileSync(filename, 'utf-8')
  //  We are being given some "JSON" like JSON which isn't actually JSON
  //  until we remove the starting '{"Events":' and final '}' and whooo
  //  a whole bunch of special characters, like so...
  //  Get rid of curly apostrophes (we may need to do this for curly quotes too)
  eventsRAW = eventsRAW.replace(/’/g, '\'')
  //  Now the rest of the special characters
  eventsRAW = eventsRAW.replace(/[^\x20-\x7E]/g, '')
  //  Get rid of the starting {"Events":
  eventsRAW = eventsRAW.split(':')
  eventsRAW.shift()
  eventsRAW = eventsRAW.join(':')
  //  Get rid of the tail ']' and the trailing special characters that
  //  go along with it
  eventsRAW = eventsRAW.split(']')
  eventsRAW.pop()
  eventsRAW = eventsRAW.join(']') + ']'

  let eventsJSON = null
  try {
    eventsJSON = JSON.parse(eventsRAW)
  } catch (er) {
    req.templateValues.error = {
      msg: 'Sorry, we failed to parse that JSON file, please try again.'
    }
    tmsLogger.object(`Failed to parse that JSON file tms ${tms}`, {
      action: 'error',
      stub: tms
    })
    return res.render('uploadJSON/results', req.templateValues)
  }

  tmsLogger.object(`New eventsJSON uploaded for tms ${tms}`, {
    action: 'upload',
    stub: tms
  })

  /* ##########################################################################

  This is where the PROCESSING STARTS

  ########################################################################## */
  if (!fs.existsSync(path.join(rootDir, 'events'))) fs.mkdirSync(path.join(rootDir, 'events'))
  if (!fs.existsSync(path.join(rootDir, 'events', tms))) fs.mkdirSync(path.join(rootDir, 'events', tms))

  //  Make sure they are correct
  eventsJSON = eventsJSON.filter((event) => {
    return ('eventId' in event)
  })

  //  De-normalise them
  const combinedEvents = {}
  eventsJSON.forEach((event) => {
    const id = parseInt(event.eventId, 10)
    if (!(id in combinedEvents)) {
      combinedEvents[id] = event
      combinedEvents[id].objects = []
    }
    const objectId = parseInt(event.objectID, 10)
    if (!isNaN(objectId)) {
      combinedEvents[id].objects.push(objectId)
    }
    const relatedObjectID = parseInt(event.relatedObjectID, 10)
    if (!isNaN(relatedObjectID)) {
      combinedEvents[id].objects.push(relatedObjectID)
    }
  })

  eventsJSON = []

  Object.entries(combinedEvents).forEach((event) => {
    eventsJSON.push(event[1])
  })

  //  In theory we now have a valid(ish) objects file. Let's go through
  //  it now and work out how many objects are new or modified
  eventsJSON.forEach((event) => {
    totalEvents += 1
    const id = parseInt(event.eventId, 10)
    const subFolder = String(Math.floor(id / 1000) * 1000)
    const filename = path.join(rootDir, 'events', tms, 'processed', subFolder, `${id}.json`)

    //  See if the files exists in processed, if it doesn't then it's a new file
    let needToUpload = false
    if (!fs.existsSync(filename)) {
      tmsLogger.object(`Creating process file for event ${id} for ${tms}`, {
        action: 'new',
        id: id,
        stub: tms
      })
      newEvents += 1
      needToUpload = true
    } else {
      //  We need to read in the file and compare to see if it's different
      const processedFileRaw = fs.readFileSync(filename, 'utf-8')
      const processedFile = JSON.stringify(JSON.parse(processedFileRaw))
      const thisObject = JSON.stringify(event)
      //  If there's a difference between the objects then we know it's been modified
      //  and we need to upload it.
      if (thisObject !== processedFile) {
        needToUpload = true
        modifiedEvents += 1
        //  Remove it from the processed fold, to force us to reupload it
        fs.unlinkSync(filename)
        tmsLogger.object(`Found changed event JSON for object ${id} for ${tms}`, {
          action: 'modified',
          id: id,
          stub: tms
        })
      }
    }

    //  If we need to upload the file then pop it into the process folder
    if (needToUpload === true) {
      if (!fs.existsSync(path.join(rootDir, 'events', tms, 'process'))) {
        fs.mkdirSync(path.join(rootDir, 'events', tms, 'process'))
      }
      if (!fs.existsSync(path.join(rootDir, 'events', tms, 'process', subFolder))) {
        fs.mkdirSync(path.join(rootDir, 'events', tms, 'process', subFolder))
      }
      const newFilename = path.join(rootDir, 'events', tms, 'process', subFolder, `${id}.json`)
      const processedFileJSONPretty = JSON.stringify(event, null, 4)
      fs.writeFileSync(newFilename, processedFileJSONPretty, 'utf-8')
    }
  })

  /* ##########################################################################

  This is where the PROCESSING ENDS

  ########################################################################## */

  //  As a seperate thing, I want to see all the fields that exist
  //  and let us know if we've found any new ones

  //  Check to see if we already have a file containing all the fields, if so read it in
  let eventsFields = []

  const eventsFieldsFilename = path.join(rootDir, 'events', tms, 'eventsFields.json')
  if (fs.existsSync(eventsFieldsFilename)) {
    eventsFields = fs.readFileSync(eventsFieldsFilename, 'utf-8')
    eventsFields = JSON.parse(eventsFields)
  }
  const eventsFieldsMap = {}

  //  Now go through all the objects looking at all the keys
  //  checking to see if we already have a record of them, if so
  //  mark them as new
  eventsJSON.forEach((event) => {
    Object.keys(event).forEach((key) => {
      //  If we don't have a record, then add it to the fields
      if (!eventsFields.includes(key)) {
        eventsFields.push(key)
        //  If we don't already have it in the fields, then it's
        //  all new
        if (!(key in eventsFieldsMap)) {
          eventsFieldsMap[key] = true
        }
      } else {
        //  If we don't have it, then we need to add it to the map
        //  but it's not new as it already exists in the array
        if (!(key in eventsFieldsMap)) {
          eventsFieldsMap[key] = false
        }
      }
    })
  })

  //  Now write the fields back out so we can compare against them next time
  const eventsFieldsJSONPretty = JSON.stringify(eventsFields, null, 4)
  fs.writeFileSync(eventsFieldsFilename, eventsFieldsJSONPretty, 'utf-8')
  req.templateValues.fields = eventsFieldsMap

  const endTime = new Date().getTime()
  tmsLogger.object(`Finished uploading event JSON file for object ${tms}`, {
    action: 'finished',
    stub: tms,
    newEvents,
    modifiedEvents,
    totalEvents,
    ms: endTime - startTime
  })
  req.templateValues.type = 'events'
  req.templateValues.newEvents = newEvents
  req.templateValues.modifiedEvents = modifiedEvents
  req.templateValues.totalEvents = totalEvents
  return res.render('uploadJSON/results', req.templateValues)
}

const processExhibitionsJSON = (req, res, tms, filename) => {
  //  TODO: Check what type of XML file we have been passed, we will do this
  //  based on the 'action' field. And will then validate (as best we can)
  //  the contents of the file based on what we've been passed
  let newExhibitions = 0
  let modifiedExhibitions = 0
  let totalExhibitions = 0
  const startTime = new Date().getTime()
  const tmsLogger = logging.getTMSLogger()

  let exhibitionsRAW = fs.readFileSync(filename, 'utf-8')
  //  We are being given some "JSON" like JSON which isn't actually JSON
  //  until we remove the starting '{"Exhibitions":' and final '}' and whooo
  //  a whole bunch of special characters, like so...
  //  Get rid of curly apostrophes (we may need to do this for curly quotes too)
  exhibitionsRAW = exhibitionsRAW.replace(/’/g, '\'')
  //  Now the rest of the special characters
  exhibitionsRAW = exhibitionsRAW.replace(/[^\x20-\x7E]/g, '')
  //  Get rid of the starting {"Exhibitions":
  exhibitionsRAW = exhibitionsRAW.split(':')
  exhibitionsRAW.shift()
  exhibitionsRAW = exhibitionsRAW.join(':')
  //  Get rid of the tail ']' and the trailing special characters that
  //  go along with it
  exhibitionsRAW = exhibitionsRAW.split(']')
  exhibitionsRAW.pop()
  exhibitionsRAW = exhibitionsRAW.join(']') + ']'

  //  Add try catch here
  let exhibitionsJSON = null
  try {
    exhibitionsJSON = JSON.parse(exhibitionsRAW)
  } catch (er) {
    req.templateValues.error = {
      msg: 'Sorry, we failed to parse that JSON file, please try again.'
    }
    tmsLogger.object(`Failed to parse that JSON file tms ${tms}`, {
      action: 'error',
      stub: tms
    })
    return res.render('uploadJSON/results', req.templateValues)
  }

  tmsLogger.object(`New exhibitionsJSON uploaded for tms ${tms}`, {
    action: 'upload',
    stub: tms
  })

  /* ##########################################################################

  This is where the PROCESSING STARTS

  ########################################################################## */
  if (!fs.existsSync(path.join(rootDir, 'exhibitions'))) fs.mkdirSync(path.join(rootDir, 'exhibitions'))
  if (!fs.existsSync(path.join(rootDir, 'exhibitions', tms))) fs.mkdirSync(path.join(rootDir, 'exhibitions', tms))

  //  Make sure they are correct
  exhibitionsJSON = exhibitionsJSON.filter((exhibition) => {
    return ('ExhibitionID' in exhibition)
  })

  //  De-normalise them
  const combinedExhibitions = {}
  exhibitionsJSON.forEach((exhibition) => {
    const id = parseInt(exhibition.ExhibitionID, 10)
    if (!(id in combinedExhibitions)) {
      combinedExhibitions[id] = exhibition
      combinedExhibitions[id].ExhObjXrefs = []
    }
    const objectId = parseInt(exhibition.ObjectID, 10)
    if (!isNaN(objectId)) {
      combinedExhibitions[id].ExhObjXrefs.push(objectId)
    }
    const relatedObjectID = parseInt(exhibition.relatedObjectID, 10)
    if (!isNaN(relatedObjectID)) {
      combinedExhibitions[id].ExhObjXrefs.push(relatedObjectID)
    }
  })

  exhibitionsJSON = []

  Object.entries(combinedExhibitions).forEach((exhibition) => {
    exhibitionsJSON.push(exhibition[1])
  })

  //  In theory we now have a valid(ish) objects file. Let's go through
  //  it now and work out how many objects are new or modified
  exhibitionsJSON.forEach((exhibition) => {
    totalExhibitions += 1
    const id = parseInt(exhibition.ExhibitionID, 10)
    const subFolder = String(Math.floor(id / 1000) * 1000)
    const filename = path.join(rootDir, 'exhibitions', tms, 'processed', subFolder, `${id}.json`)

    delete exhibition.ObjectID
    delete exhibition.relatedObjectID
    exhibition.description = exhibition.Description
    delete exhibition.Description

    //  See if the files exists in processed, if it doesn't then it's a new file
    let needToUpload = false
    if (!fs.existsSync(filename)) {
      tmsLogger.object(`Creating process file for exhibition ${id} for ${tms}`, {
        action: 'new',
        id: id,
        stub: tms
      })
      newExhibitions += 1
      needToUpload = true
    } else {
      //  We need to read in the file and compare to see if it's different
      const processedFileRaw = fs.readFileSync(filename, 'utf-8')
      const processedFile = JSON.stringify(JSON.parse(processedFileRaw))
      const thisObject = JSON.stringify(exhibition)
      //  If there's a difference between the objects then we know it's been modified
      //  and we need to upload it.
      if (thisObject !== processedFile) {
        needToUpload = true
        modifiedExhibitions += 1
        //  Remove it from the processed fold, to force us to reupload it
        fs.unlinkSync(filename)
        tmsLogger.object(`Found changed exhibition JSON for object ${id} for ${tms}`, {
          action: 'modified',
          id: id,
          stub: tms
        })
      }
    }

    //  If we need to upload the file then pop it into the process folder
    if (needToUpload === true) {
      if (!fs.existsSync(path.join(rootDir, 'exhibitions', tms, 'process'))) {
        fs.mkdirSync(path.join(rootDir, 'exhibitions', tms, 'process'))
      }
      if (!fs.existsSync(path.join(rootDir, 'exhibitions', tms, 'process', subFolder))) {
        fs.mkdirSync(path.join(rootDir, 'exhibitions', tms, 'process', subFolder))
      }
      const newFilename = path.join(rootDir, 'exhibitions', tms, 'process', subFolder, `${id}.json`)
      const processedFileJSONPretty = JSON.stringify(exhibition, null, 4)
      fs.writeFileSync(newFilename, processedFileJSONPretty, 'utf-8')
    }
  })

  /* ##########################################################################

  This is where the PROCESSING ENDS

  ########################################################################## */

  //  As a seperate thing, I want to see all the fields that exist
  //  and let us know if we've found any new ones

  //  Check to see if we already have a file containing all the fields, if so read it in
  let exhibitionsFields = []

  const exhibitionsFieldsFilename = path.join(rootDir, 'exhibitions', tms, 'exhibitionsFields.json')
  if (fs.existsSync(exhibitionsFieldsFilename)) {
    exhibitionsFields = fs.readFileSync(exhibitionsFieldsFilename, 'utf-8')
    exhibitionsFields = JSON.parse(exhibitionsFields)
  }
  const exhibitionsFieldsMap = {}

  //  Now go through all the objects looking at all the keys
  //  checking to see if we already have a record of them, if so
  //  mark them as new
  exhibitionsJSON.forEach((exhibition) => {
    Object.keys(exhibition).forEach((key) => {
      //  If we don't have a record, then add it to the fields
      if (!exhibitionsFields.includes(key)) {
        exhibitionsFields.push(key)
        //  If we don't already have it in the fields, then it's
        //  all new
        if (!(key in exhibitionsFieldsMap)) {
          exhibitionsFieldsMap[key] = true
        }
      } else {
        //  If we don't have it, then we need to add it to the map
        //  but it's not new as it already exists in the array
        if (!(key in exhibitionsFieldsMap)) {
          exhibitionsFieldsMap[key] = false
        }
      }
    })
  })

  //  Now write the fields back out so we can compare against them next time
  const exhibitionsFieldsJSONPretty = JSON.stringify(exhibitionsFields, null, 4)
  fs.writeFileSync(exhibitionsFieldsFilename, exhibitionsFieldsJSONPretty, 'utf-8')
  req.templateValues.fields = exhibitionsFieldsMap

  const endTime = new Date().getTime()
  tmsLogger.object(`Finished uploading exhibition JSON file for object ${tms}`, {
    action: 'finished',
    stub: tms,
    newExhibitions,
    modifiedExhibitions,
    totalExhibitions,
    ms: endTime - startTime
  })
  req.templateValues.type = 'exhibitions'
  req.templateValues.newExhibitions = newExhibitions
  req.templateValues.modifiedExhibitions = modifiedExhibitions
  req.templateValues.totalExhibitions = totalExhibitions
  return res.render('uploadJSON/results', req.templateValues)
}