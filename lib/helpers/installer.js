const path = require('path')
const { fs, exec } = require('../utils')

const isWindows = process.platform === 'win32'

/**
 * Check if need to install dependencies
 * @param {string} dir target path
 * @param {string} fieldName field of package.json
 * @returns
 */
async function check (dir, type = 'prod') {
  const fieldName = type === 'prod' ? 'dependencies' : 'devDependencies'

  // Check if package.json exist
  const pkgFile = path.join(dir, 'package.json')
  const pkgExist = await fs.exist(pkgFile)
  if (!pkgExist) {
    return false
  }

  // Check has declared dependencies
  const pkg = require(pkgFile)
  const deps = pkg[fieldName] && Object.keys(pkg[fieldName]).length > 0
  if (!deps) {
    return false
  }

  // Check if node_modules is empty
  const modulesDir = path.join(dir, 'node_modules')

  return fs.isEmptyDir(modulesDir)
}

/**
 * Install dependencies
 *
 * @param {string} dir directory
 */
async function start ({
  command = 'npm',
  action = 'install',
  packages = [],
  extra = '',
  dir = '.',
  type = 'prod',
  logger,
  show
}) {
  let options = ''
  switch (command) {
    case 'yarn':
      if (packages.length > 0) {
        action = 'add'
      }
      if (action === 'install') {
        // $ yarn install --prod
        // $ yarn install
        options = type === 'prod' ? '--prod' : ''
      } else if (action === 'add') {
        // $ yarn add [package]
        // $ yarn add [package] [--dev/-D]
        options = type === 'prod' ? '' : '--dev'
      }
      break
    default:
      if (packages.length > 0) {
        // $ npm install [package] --save
        // $ npm install [package] --save-dev
        options = type === 'prod' ? '--save' : '--save-dev'
      } else {
        // $ npm install --only=prod
        // $ npm install --only=dev
        // fix 'module not found'
        // options = type === 'prod' ? '--only=prod' : '--only=dev'
      }
      break
  }

  command = isWindows ? command + '.cmd' : command

  const cmd = `${command} ${action} ${packages.join(' ')} ${options} ${extra}`
  logger.log('Exec command:', cmd)

  await exec(
    cmd,
    {
      cwd: dir,
      stdio: show ? 'inherit' : 'ignore'
    },
    logger
  )
  logger.log(`${type} dependencies installed.`)

  return true
}

module.exports = {
  check,
  start
}
