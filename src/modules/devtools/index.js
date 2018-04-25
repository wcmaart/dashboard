const sane = require('sane')
const spawnSync = require('child_process').spawnSync
const fs = require('fs')
const path = require('path')
const rootDir = path.join(__dirname, '../../..')
const mkdirp = require('mkdirp')
const sass = require('node-sass')

const watchJS = () => {
  //  Watch for JS changes
  const watcherJS = sane(path.join(rootDir, '/src'), { glob: ['**/*.js'] })
  watcherJS.on('change', function (filepath, root, stat) {
    console.log('updated file: ', filepath)
    spawnSync('npx', [
      'babel',
      path.join(rootDir, '/src', filepath),
      '--out-file',
      path.join(rootDir, '/app', filepath)
    ])
  })
  watcherJS.on('add', function (filepath, root, stat) {
    console.log('New file: ', filepath)
    //  We need to make sure the directory we are going to put this
    //  into exists
    const dir = path.join(rootDir, '/app', filepath).split('/')
    dir.pop()
    mkdirp.sync(dir.join('/'))
    spawnSync('npx', [
      'babel',
      path.join(rootDir, '/src', filepath),
      '--out-file',
      path.join(rootDir, '/app', filepath)
    ])
  })
}

const watchCSS = () => {
  //  Watch for CSS changes
  const watcherCSS = sane(path.join(rootDir, '/src/sass'), {
    glob: ['**/*.scss']
  })
  watcherCSS.on('change', function (filepath, root, stat) {
    console.log('updated file: ', filepath)
    const sassResult = sass.renderSync({
      file: path.join(rootDir, '/src/sass/main.scss'),
      outputStyle: 'compact',
      outFile: path.join(rootDir, '/app/public/css/main.css'),
      sourceMap: true
    })
    fs.writeFileSync(
      path.join(rootDir, '/app/public/css/main.css.map'),
      sassResult.map
    )
    fs.writeFileSync(
      path.join(rootDir, '/app/public/css/main.css'),
      sassResult.css
    )
  })
  watcherCSS.on('add', function (filepath, root, stat) {
    console.log('New file: ', filepath)
    const sassResult = sass.renderSync({
      file: path.join(rootDir, '/src/sass/main.scss'),
      outputStyle: 'compact',
      outFile: path.join(rootDir, '/app/public/css/main.css'),
      sourceMap: true
    })
    fs.writeFileSync(
      path.join(rootDir, '/app/public/css/main.css.map'),
      sassResult.map
    )
    fs.writeFileSync(
      path.join(rootDir, '/app/public/css/main.css'),
      sassResult.css
    )
  })
}

const watchStatic = () => {
  //  Watch for JS changes
  const watcherStatic = sane(path.join(rootDir, '/src'), {
    glob: ['**/*.html', '**/*.png', '**/*.jpg', '**/*.jpeg']
  })
  watcherStatic.on('change', function (filepath, root, stat) {
    console.log('updated file: ', filepath)
    const source = path.join(rootDir, '/src', filepath)
    const target = path.join(rootDir, '/app', filepath)
    fs.copyFileSync(source, target)
  })
  watcherStatic.on('add', function (filepath, root, stat) {
    console.log('updated file: ', filepath)
    const source = path.join(rootDir, '/src', filepath)
    const target = path.join(rootDir, '/app', filepath)
    const dir = target.split('/')
    dir.pop()
    mkdirp.sync(dir.join('/'))
    fs.copyFileSync(source, target)
  })
}

const watcher = () => {
  watchJS()
  watchCSS()
  watchStatic()
}
exports.watcher = watcher
