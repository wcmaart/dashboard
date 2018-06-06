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

Below you will find all the notes



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