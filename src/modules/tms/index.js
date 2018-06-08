const request = require('request-promise')
const Config = require('../../classes/config')
const logging = require('../logging')
const elasticsearch = require('elasticsearch')

const fs = require('fs')
const path = require('path')
const rootDir = path.join(__dirname, '../../../data')

//  This saves the TMS source image for the ID into the
//  "perfect" folder
//  NOTE: This doesn't handle the actual uploading of the image
//  that happens in a seperate module than scans the folders for
//  things that have a tmsSource set but the remote is still
//  null
const saveImageSource = (stub, id, source) => {
  const tmsLogger = logging.getTMSLogger()

  //  First things first, check to see if we have a directory to
  //  look in for this stub
  if (!fs.existsSync(rootDir)) fs.mkdirSync(rootDir)
  if (!fs.existsSync(path.join(rootDir, 'tms'))) fs.mkdirSync(path.join(rootDir, 'tms'))
  if (!fs.existsSync(path.join(rootDir, 'tms', stub))) fs.mkdirSync(path.join(rootDir, 'tms', stub))
  if (!fs.existsSync(path.join(rootDir, 'tms', stub, 'perfect'))) fs.mkdirSync(path.join(rootDir, 'tms', stub, 'perfect'))

  //  To keep things tidy we split the folder down into 1000s
  const subFolder = String(Math.floor(id / 1000) * 1000)
  if (!fs.existsSync(path.join(rootDir, 'tms', stub, 'perfect', subFolder))) fs.mkdirSync(path.join(rootDir, 'tms', stub, 'perfect', subFolder))

  //  Now we are all set to go
  const filename = path.join(rootDir, 'tms', stub, 'perfect', subFolder, `${id}.json`)
  let perfectFile = {}
  let perfectFileJSONPretty = ''

  //  Trim the source path to get rid of the jsession stuff
  let newSource = null
  if (source !== null) {
    newSource = source.split('/')
    newSource.pop()
    newSource = newSource.join('/')
  }

  //  Now see if a file already exists, if not, then we add it
  if (!fs.existsSync(filename)) {
    tmsLogger.object(`Creating perfect file for object ${id} for ${stub}`, {
      action: 'new',
      id: id,
      stub: stub,
      source: newSource
    })
    perfectFile = {
      tmsSource: newSource,
      oldTMSSource: null,
      remote: null,
      oldRemote: null
    }
    perfectFileJSONPretty = JSON.stringify(perfectFile, null, 4)
    fs.writeFileSync(filename, perfectFileJSONPretty, 'utf-8')
  }

  //  Read in the file that may or may not have just been written
  const perfectFileRaw = fs.readFileSync(filename, 'utf-8')
  perfectFile = JSON.parse(perfectFileRaw)

  //  Now we check to see if the tmsSource is different to the currently stored
  //  source, if so then we need to set the remote to null so we go and process it again
  if (perfectFile.tmsSource !== newSource) {
    tmsLogger.object(`New TMS source image found for ${id} for ${stub}`, {
      action: 'update',
      id: id,
      stub: stub,
      tmsSource: newSource
    })
    //  Shuffle the image sources into the old ones, just incase we want to
    //  use _something_ inbetween finding out we need to refetch the image
    //  and having actually fetched it
    perfectFile.oldTMSSource = perfectFile.tmsSource
    perfectFile.tmsSource = newSource
    perfectFile.oldRemote = perfectFile.remote
    perfectFile.remote = null
    perfectFileJSONPretty = JSON.stringify(perfectFile, null, 4)
    fs.writeFileSync(filename, perfectFileJSONPretty, 'utf-8')

    //  We also need to move the file from the 'processed' folder into the process
    //  folder if it exists, to make it trigger a new upload
    const sourceObjectJSON = path.join(rootDir, 'tms', stub, 'processed', subFolder, `${id}.json`)
    if (fs.existsSync(sourceObjectJSON)) {
      tmsLogger.object(`Remove ${id} for ${stub} from processed folder and putting into process`, {
        action: 'modified',
        id: id,
        stub: stub
      })
      //  Make sure the directory we are trying to copy into exists
      //  (in theory of course it should, but you know!)
      if (!fs.existsSync(path.join(rootDir, 'tms', stub, 'process'))) {
        fs.mkdirSync(path.join(rootDir, 'tms', stub, 'process'))
      }
      if (!fs.existsSync(path.join(rootDir, 'tms', stub, 'process', subFolder))) {
        fs.mkdirSync(path.join(rootDir, 'tms', stub, 'process', subFolder))
      }
      const targetObjectJSON = path.join(rootDir, 'tms', stub, 'process', subFolder, `${id}.json`)
      //  Move the file over
      fs.renameSync(sourceObjectJSON, targetObjectJSON)
    }
  }
}

const fetchPage = () => {
  const tmsLogger = logging.getTMSLogger()

  //  get the TMS sources we have registered
  const config = new Config()
  const tmsses = config.get('tms')

  //  If there are no tmsses registed then we dont
  //  do anything
  if (tmsses === null) {
    return
  }

  //  Now go through each one in turn to see if
  //  we need to get a page of data for it
  tmsses.forEach((tms) => {
    //  If there's no page entry, then we need to add one
    if (!('page' in tms)) {
      tms.page = 1
      tms.nextFetch = new Date().getTime() - 1000
      config.save()
    }
  })

  //  Now loop through and actually fetch the each page
  tmsses.forEach((tms) => {
    if (new Date().getTime() > tms.nextFetch) {
      tmsLogger.object(`Fetching page ${tms.page} for tms ${tms.stub}`, {
        action: 'fetch',
        page: tms.page,
        stub: tms.stub
      })
      const startTime = new Date().getTime()

      const url = `${tms.url}/objects/json?key=${tms.key}&page=${tms.page}`
      request({
        method: 'GET',
        url: url,
        headers: {
          'content-type': 'application/json'
        },
        json: true
      }).then(response => {
        //  If we got that there was an error, then we assume we've reached the end
        //  of the and should go back to the start and tell it not to restart for
        //  another hour
        const endTime = new Date().getTime()
        if ('error' in response) {
          tmsLogger.object(`Reached last page for tms ${tms.stub}, resetting to page 1`, {
            action: 'reset',
            page: tms.page,
            stub: tms.stub,
            ms: (endTime - startTime)
          })

          tms.page = 1
          tms.nextFetch = new Date().getTime() + (1000 * 60 * 60)
          config.save()
          return
        }

        //  We got good results back, so set the page to the next one
        tmsLogger.object(`Received ${response.objects.length} objects for ${tms.stub}, page ${tms.page}`, {
          action: 'received',
          page: tms.page,
          stub: tms.stub,
          objects: response.objects.length,
          ms: (endTime - startTime)
        })

        //  Now store that we want to get the next page
        tms.page += 1
        tms.nextFetch = new Date().getTime()
        config.save()
        const media = response.objects.map((record) => {
          const shorter = {
            id: record.id.value,
            source: record.primaryMedia.value
          }
          if (shorter.source === '') shorter.source = null
          return shorter
        })

        //  Go through each media object tucking away the source
        media.forEach((record) => {
          saveImageSource(tms.stub, record.id, record.source)
        })
      }).catch(error => {
        const endTime = new Date().getTime()
        tmsLogger.object(`Failed while trying to fetch objects for ${tms.stub}, page ${tms.page}`, {
          action: 'error',
          page: tms.page,
          stub: tms.stub,
          error: error,
          url: url,
          ms: (endTime - startTime)
        })
        tms.nextFetch = new Date().getTime() + (1000 * 60 * 5)
        config.save()
      })
    } else {
      tmsLogger.object(`Skipping page ${tms.page} for tms ${tms.stub}, not time yet`, {
        action: 'skipping',
        page: tms.page,
        stub: tms.stub
      })
    }
  })
}

const getUniques = async () => {
  const tmsDir = path.join(rootDir, 'tms')
  if (!fs.existsSync(tmsDir)) return

  //  Check to see that we have elasticsearch configured
  const config = new Config()
  const elasticsearchConfig = config.get('elasticsearch')
  //  If there's no elasticsearch configured then we don't bother
  //  to do anything
  if (elasticsearchConfig === null) {
    return
  }

  const tmsLogger = logging.getTMSLogger()

  const objectTypes = {}
  const objectMakers = {}
  const objectPeriods = {}
  const objectMaterials = {}

  const startTime = new Date().getTime()
  tmsLogger.object(`Checking distinct records`, {
    action: 'checkingDistinct'
  })

  //  This is going to loop through all the process and processed
  //  folders in each tms system we have on. Opening all the files
  //  and aggregating the data. We are doing this as we may as well
  //  take the hit here, rather than asking the DB all the time for
  //  the values. At least until I find a better way of doing this
  const tmsses = fs.readdirSync(tmsDir)
  tmsses.forEach((tms) => {
    const processDir = path.join(tmsDir, tms, 'process')
    const processedDir = path.join(tmsDir, tms, 'processed')
    const perfectDir = path.join(tmsDir, tms, 'perfect')

    const checkDirs = []
    if (fs.existsSync(processDir)) checkDirs.push(processDir)
    if (fs.existsSync(processedDir)) checkDirs.push(processedDir)
    checkDirs.forEach((pDir) => {
      const subFolders = fs.readdirSync(pDir)
      subFolders.forEach((subFolder) => {
        const files = fs.readdirSync(path.join(pDir, subFolder)).filter(file => {
          const fileFragments = file.split('.')
          if (fileFragments.length !== 2) return false
          if (fileFragments[1] !== 'json') return false
          return true
        })
        //  Finally we are down to the files, now go through them
        //  plucking out the values we want to keep
        files.forEach((file) => {
          const objectRaw = fs.readFileSync(path.join(pDir, subFolder, file), 'utf-8')
          const object = JSON.parse(objectRaw)

          const perfectFilename = path.join(perfectDir, subFolder, file)
          let remote = null
          if (fs.existsSync(perfectFilename)) {
            const perfectObjectRaw = fs.readFileSync(perfectFilename, 'utf-8')
            const perfectObject = JSON.parse(perfectObjectRaw)
            if ('remote' in perfectObject && perfectObject.remote !== null && 'status' in perfectObject.remote && perfectObject.remote.status === 'ok') {
              remote = perfectObject.remote
            }
          }
          //  Object Types
          if ('object_name' in object && object.object_name !== null && object.object_name !== '') {
            if (!(object.object_name in objectTypes)) {
              objectTypes[object.object_name] = {
                count: 0,
                images: [],
                keyImage: null
              }
            }
            objectTypes[object.object_name].count += 1
            //  If there's an image we want to make a note of that to, so
            //  we can use it when displaying the index page for these thing
            //  We are going to build up an array, from which we'll pick 5
            //  random items, and a "keyImage" which will just be the first
            //  one we come across
            if (remote !== null) {
              objectTypes[object.object_name].images.push(remote)
              if (objectTypes[object.object_name].keyImage === null) {
                objectTypes[object.object_name].keyImage = remote
              }
            }
          }

          //  Makers
          if ('maker' in object && object.maker !== null && object.maker !== '') {
            if (!(object.maker in objectMakers)) {
              objectMakers[object.maker] = {
                count: 0,
                images: [],
                keyImage: null
              }
            }
            objectMakers[object.maker].count += 1
            if (remote !== null) {
              objectMakers[object.maker].images.push(remote)
              if (objectMakers[object.maker].keyImage === null) {
                objectMakers[object.maker].keyImage = remote
              }
            }
          }

          //  Periods
          if ('period' in object && object.period !== null && object.period !== '') {
            if (!(object.period in objectPeriods)) {
              objectPeriods[object.period] = {
                count: 0,
                images: [],
                keyImage: null
              }
            }
            objectPeriods[object.period].count += 1
            if (remote !== null) {
              objectPeriods[object.period].images.push(remote)
              if (objectPeriods[object.period].keyImage === null) {
                objectPeriods[object.period].keyImage = remote
              }
            }
          }

          //  Materials
          if ('medium' in object && object.medium !== null && object.medium !== '') {
            if (!(object.medium in objectMaterials)) {
              objectMaterials[object.medium] = {
                count: 0,
                images: [],
                keyImage: null
              }
            }
            objectMaterials[object.medium].count += 1
            if (remote !== null) {
              objectMaterials[object.medium].images.push(remote)
              if (objectMaterials[object.medium].keyImage === null) {
                objectMaterials[object.medium].keyImage = remote
              }
            }
          }
        })
      })
    })
  })

  tmsLogger.object(`Checked distinct records`, {
    action: 'checkedDistinct',
    ms: new Date().getTime() - startTime
  })

  const bulking = [{
    index: 'object_types_wcma',
    type: 'object_type',
    source: objectTypes,
    counter: 0
  },
  {
    index: 'object_makers_wcma',
    type: 'object_makers',
    source: objectMakers,
    counter: 0
  },
  {
    index: 'object_periods_wcma',
    type: 'object_period',
    source: objectPeriods,
    counter: 0
  },
  {
    index: 'object_materials_wcma',
    type: 'object_materials',
    source: objectMaterials,
    counter: 0
  }
  ]

  const esclient = new elasticsearch.Client(elasticsearchConfig)

  bulking.forEach(async (bulkThis) => {
    const bulkThisArray = []
    const index = bulkThis.index
    const type = bulkThis.type

    Object.entries(bulkThis.source).forEach((keyVal) => {
      const objectType = keyVal[0]
      const data = keyVal[1]
      const count = data.count
      const images = data.images
      const keyImage = data.keyImage
      let newImages = []
      const maxImages = 5
      //  If we have more than 5 images then we need to randomly pick 5 to use
      //  otherwise if we have 5 or less just use them as is
      if (images.length > maxImages) {
        while (newImages.length < 5) {
          newImages.push(images.splice(Math.floor(Math.random() * images.length), 1))
        }
      } else {
        newImages = images
      }

      bulkThisArray.push({
        index: {
          _id: bulkThis.counter
        }
      })
      bulkThisArray.push({
        id: bulkThis.counter,
        title: objectType,
        count,
        images: newImages,
        keyImage
      })
      bulkThis.counter += 1
    })

    //  Now that we have our data, we need to store it into the database
    const exists = await esclient.indices.exists({
      index
    })
    if (exists !== true) {
      await esclient.indices.create({
        index
      })
    }
    esclient.bulk({
      index,
      type,
      body: bulkThisArray
    }).then(() => {
      tmsLogger.object(`Bulk uploaded ${index}`, {
        action: 'bulkUploaded',
        index,
        ms: new Date().getTime() - startTime
      })
    })
  })
}

exports.startFetching = () => {
  setInterval(() => {
    fetchPage()
  }, 1000 * 60)
  fetchPage()
}

exports.getUniques = () => {
  setInterval(() => {
    getUniques()
  }, 1000 * 60 * 60)
  getUniques()
}
