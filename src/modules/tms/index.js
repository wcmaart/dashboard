const request = require('request-promise')
const Config = require('../../classes/config')
const logging = require('../logging')

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

  //  Now see if a file already exists, if not, then we add it
  if (!fs.existsSync(filename)) {
    tmsLogger.object(`Creating perfect file for object ${id} for ${stub}`, {
      action: 'new',
      id: id,
      stub: stub,
      source: source
    })
    perfectFile = {
      tmsSource: source,
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
  if (perfectFile.tmsSource !== source) {
    tmsLogger.object(`New TMS source image found for ${id} for ${stub}`, {
      action: 'update',
      id: id,
      stub: stub,
      tmsSource: source
    })
    //  Shuffle the image sources into the old ones, just incase we want to
    //  use _something_ inbetween finding out we need to refetch the image
    //  and having actually fetched it
    perfectFile.oldTMSSource = perfectFile.source
    perfectFile.tmsSource = source
    perfectFile.oldRemote = perfectFile.remote
    perfectFile.remote = null
    perfectFileJSONPretty = JSON.stringify(perfectFile, null, 4)
    fs.writeFileSync(filename, perfectFileJSONPretty, 'utf-8')
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

exports.startFetching = () => {
  setInterval(() => {
    fetchPage()
  }, 1000 * 60)
  fetchPage()
}
