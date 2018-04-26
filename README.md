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

`yarn start --port 4000 --host localhost --env production`

Or whichever port you want to run it on.

This will write out a new `.env` file each time, you shouldn't add anything else to the `.env` file as it'll be over written. The app will guide you through adding extra settings information to the `config.json` file instead.

**Note:** there is no `config.json` file yet! :)

As you deploy new code, you just need to get the new code then restart the app running `yarn start` and it will automatically rebuild all the files you need.

_In theory_

Better still, install `pm2` and just tell it to restart the app whenever changes are pushed/pulled to the server.

I am now about to test all this!