const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const request = require('request-promise')
const auth0 = require('../auth0')

const rootDir = path.join(__dirname, '../../..')

/*
 * This will go and get the user from Auth0, this is the object
 * that we want to use everywhere else in the system
 */
const getUserSync = async id => {
  const auth0Token = await auth0.getAuth0Token()
  const payload = {}
  const user = await request({
    url: `https://${global.config.auth0.AUTH0_DOMAIN}/api/v2/users/${id}`,
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      Authorization: `bearer ${auth0Token}`
    },
    json: payload
  })
    .then(response => {
      return response
    })
    .catch(error => {
      return [error]
    })
  return user
}

/*
 * This will set a developer API token on the user
 */
const setApiToken = async id => {
  const auth0Token = await auth0.getAuth0Token()
  const newToken = crypto
    .createHash('md5')
    .update(`${Math.random()}`)
    .digest('hex')
  const payload = {
    user_metadata: {
      apitoken: newToken
    }
  }
  const user = await request({
    url: `https://${global.config.auth0.AUTH0_DOMAIN}/api/v2/users/${id}`,
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      Authorization: `bearer ${auth0Token}`
    },
    json: payload
  })
    .then(response => {
      return response
    })
    .catch(error => {
      return [error]
    })
  return user
}

const setRoles = async (id, roles) => {
  const auth0Token = await auth0.getAuth0Token()
  const payload = {
    user_metadata: {
      roles: roles
    }
  }
  const user = await request({
    url: `https://${global.config.auth0.AUTH0_DOMAIN}/api/v2/users/${id}`,
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      Authorization: `bearer ${auth0Token}`
    },
    json: payload
  })
    .then(response => {
      return response
    })
    .catch(error => {
      return [error]
    })
  return user
}

const getUser = async id => {
  let user = await getUserSync(id)
  //  Check to see if we have set the admin user yet
  //  if not then we need to do that now
  if (!('adminSet' in global.config) || global.config.adminSet === false) {
    const roles = {
      isAdmin: true,
      isStaff: true,
      isDeveloper: true
    }
    user = await setRoles(id, roles)
    global.config.adminSet = true
    const configFile = path.join(rootDir, 'config.json')
    const configJSONPretty = JSON.stringify(global.config, null, 4)
    fs.writeFileSync(configFile, configJSONPretty, 'utf-8')
  }

  //  Check to see if any roles have been set on the user, if not then
  //  apply the default roles
  if (!('user_metadata' in user) || !('roles' in user.user_metadata)) {
    const roles = {
      isAdmin: false,
      isStaff: false,
      isDeveloper: true
    }
    user = await setRoles(id, roles)
  }

  //  Make sure we have a developer API token
  if (!('user_metadata' in user) || !('apitoken' in user.user_metadata)) {
    user = await setApiToken(id)
  }
  return user
}

class User {
  async get (auth0id) {
    //  Grab the id from the user object or a string
    let id = null
    if (typeof auth0id === 'object') {
      id = auth0id.id
    } else {
      id = auth0id
    }

    //  Go and get the user from Auth0
    const user = await getUser(id)
    return user
  }

  async setRoles (id, roles) {
    const user = await setRoles(id, roles)
    return user
  }
}
module.exports = User
