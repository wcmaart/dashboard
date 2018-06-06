# The Dashboard

This repo is part of the [WCMA TRICMA](https://github.com/wcmaart/tricma) project, which is attempting to take data out of an eMuseum [TMS system](https://www.gallerysystems.com/products-and-services/tms-suite/tms/) and let 3rd part developers consume that data via an [API](https://github.com/wcmaart/api) endpoint.

The dashboards role is to connect to TMS systems to extract data, and allow users to upload JSON files (of a specific format), and then aggregate that data into a data store, as well as extracting and storing images for that data.

While also managing Admin, Staff and (3rd party) developer user roles, admin healthcheck views of the system and developer documentation.

It is, in short a "dashboard" where people of various roles can manage various tools.

This is where the Dashboard fits into the overall architecture of the system, see the [TRICMA repo](https://github.com/wcmaart/tricma) for more details of the overall system.

![Dashboard overview](https://raw.githubusercontent.com/wcmaart/tricma/master/media/overview-dashboard.png)

## Table of Contents

+ [Installation](installation)
  + [Prerequisites](#prerequisites)
  + [Starting in development](#starting-in-development)
  + [Starting in production](#starting-in-production)
+ [Running for the first time in development](#running-for-the-first-time-in-development)
+ [Running for the first time in production](#running-for-the-first-time-in-production)
+ [Configuring and connecting to everything](#configuring-and-connecting-to-everything)
  + [Auth0](#auth0)
  + [TMS systems](#tms-systems)
  + [ElasticSearch](#elasticsearch)
  + [Cloudinary](#cloudinary)
  + [GraphQL](#graphql)
+ Admin tools
  + Managing users
+ Staff tools
  + The config page
  + The stats page
  + Reading logs
  + Uploading JSON files
  + Speeding up and slowing down data handling
  + Checking system health
+ 3rd party developer tools
  + Developer API Token
  + System status
  + Documentation
+ Working with this code for developers
  + What does this code
  + Things to look out for
  + Custom TMS data parsing code
  + Custom JSON data parsing code

# Installation

Below you will find all the notes you need to get up and running with the dashboard, _note_ this has been tested on OSX and ubuntu, as for Windows ¯\_(ツ)_/¯

### Prerequisites

Before anything else you will need to make sure you have installed the following...

+ [Nodejs](https://nodejs.org/en/)
+ [Yarn](https://yarnpkg.com/en/docs/install)
+ Some flavour of git (obviously)

The clone the repository and read the next section before doing anything else.

You will probably also need to...

+ Set up an instance of ElasticSearch and Kibana
+ Sign up to [Auth0](https://auth0.com)
+ Create an account on [Cloudinary](https://cloudinary.com/console)

...I advice setting up a "developer" and "production" version of each of the above, unless you intend on running _just_ a developer version or _just_ a production version. And hey, staging too if you wish.

### Starting in development

The code has been written so that running `yarn start` will install all the node modules you need (this may take a while the first time), build the code and start the app, it will _also_ start a "watcher" that will watch for code changes and restart the app. This means you _don't_ have to use `nodemon` or any other tools, just run `yarn start` and you should be good to go.

(_Note:_ to restart the app it attempts to kill the old process and starts a new one. Sometimes for various reasons an old version of the app may be left running, it will always write a file called `.pid` in the app's root directory should you need to kill the app by hand, with `kill -9 $(cat .pid)`)

There are a couple of useful command line parameters you can use...

`--skipOpen` will start the app _without_ trying to open a browser.  
`--skipBuild` will start the app _without_ running a `yarn install` or rebuilding any of the node or css files.

After your first `yarn start` you should read [Running for the first time in development](#running-for-the-first-time-in-development)

### Starting in production

Running `yarn start` in production mode will install all the node modules you need, build the code and then start the app. Unlike running in development mode it _will not_ create a watcher to watch for code changes.

If you are using a process manager tool like `PM2` ([github.com/Unitech/pm2](https://github.com/Unitech/pm2)) restarting the app with `pm2 restart [app id|name]` (say after a git pull, or deploy) will repeat the check for new modules and rebuild the code before starting.

If you wish to run the traditional `yarn install` and build step yourself you can use the `--skipBuild` option.

You can also specify port, host and environment directly on the commandline, for example...

`yarn start --port 4002 --host localhost --env production`

...there's more information on this in [Running for the first time in production](#running-for-the-first-time-in-production).

An example of a new "deploy" once you have `PM2` running the dashboard may look like...

1. `git pull`
2. `pm2 restart dashboard`

If you initially started the app in `PM2` with the skikBuild option i.e. `yarn start --skipBuild` then your deply would need an extra build step in.

1. `git pull`
2. `yarn build`
3. `pm2 restart dashboard`




---
Everything below here is old markup and should be ignored.

# dashboard

Dashboard to coordinate the other parts of the wcma api

## Install

These are rough untested notes on how to install the dash board. Please note the dashboard doesn't do anything at the moment other than fire up a web page.

Step 1, make sure you have `node` and `yarn` and `git` installed. Then clone this repository. Next type...

`yarn start`

It will ask you some questions about the `port`, `host` and node environment to use (which should be `development`, `staging` or `production`).

### Installing and running for development

Typing `yarn start` will build everything you need. When in development the application will recompile the `.js` files, `.scss` files and static files in the `public` and `templates` directory, and then restart itself.

**Note:** because it's restarting itself by spawning a child process if you Ctrl+C or crash out of the app it may leave the process running. The app will attempt to clean up and kill the old process before starting a new one. It will also write out a `.pid` file in the root directory if you need to kill the process by hand (`kill - [pid]`).

You should now be able to develop more or less happily.

### Installing and running for production

If you are on the machine you are installing to, which you probably will be as you'll want to set up `pm2` or `forever` or something, you can run `yarn start` and it will ask you the host, port and environment questions. You can also start the app with...

`yarn start --port 4002 --host localhost --env production`

Or whichever port you want to run it on.

This will write out a new `.env` file each time, you shouldn't add anything else to the `.env` file as it'll be over written. The app will guide you through adding extra settings information to the `config.json` file instead.

**Note:** there is no `config.json` file yet! :)

As you deploy new code, you just need to get the new code then restart the app running `yarn start` and it will automatically rebuild all the files you need.

_In theory_

Better still, install `pm2` and just tell it to restart the app whenever changes are pushed/pulled to the server.

I am now about to test all this!

---