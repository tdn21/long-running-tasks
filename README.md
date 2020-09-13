# Long Running Tasks app
This repository contains source code for Node.js REST API providing user routes to stop long-running task and later resume or terminate them.
<br />
* PS * This is a very crude implementation and needs work to become a mature application.

#### Will add complete information about endpoints soon!

## Problem Statement
Atlan Collect has a variety of long-running tasks that require time and resources on the servers. As it stands now, once we have triggered off a long-running task, there is no way to tap into it and pause/stop/terminate the task, upon realizing that an erroneous request went through from one of the clients.
<br />

#### Example tasks
* Uploading large files.
* Extracting large amount of data.
* Bulk team creation.

## General idea of solution
In each service (Upload/Extract/Team), on getting start request with required headers and data:
* intialize child process using "fork" method and pass the required arguments.
* if req data is large (as in upload case), stream it using 'pipe' defined on fd 3 of child process.
* added 'ipc' channel and event listeners to act on events from both child process and parent process.
* on completion of task, exit the child process.
* on getting pause or terminate request kill the child process.
* on pause request, save the current state of child process to use it later for resuming process.
* on terminate, if process is already paused, remove state of paused request, else kill the child process and remove current state of process.

<br />
<br />

In case of upload service, on pause, we are representing current state by how much data is uploaded i.e. start position for resumed process in case process gets paused.

### Assumptions
* Services are used by authenticated users and hence every user have some sort of unique user id.
* To each service, a user can make atmost one service request at a time. (Multiple uploads, extracts, bulk team creation are currently not supported)
* To demonstrate "extract data" and "team creation" process, instead of reading data from some database or other source, i'm reading it from files in data directory and work on them.

## Further improvements
* Adding Redis or something similar to store tasks data, and some database(MongoDB etc.) to store uploaded files instead of storing them internally. <br />
These databases will act as one source of truth and allow multiple instance of node app to run.
* For now, multiple tasks on single service are not supported for a particular user, this could be improved by using task ID's. As of now, i'm using user ID in similar fashion.
* Refactor code to make it more modular, readable, and add required things to make it more fault tolerent.

## Endpoints available

#### Upload endpoints
* `POST /upload/start`
* `GET /upload/status`
* `GET /upload/pause`
* `GET /upload/terminate`

#### Extract endpoints
* `GET /extract/start`
* `GET /extract/status`
* `GET /extract/pause`
* `GET /extract/resume`
* `GET /extract/terminate`

#### Upload endpoints
* `GET /team/start`
* `GET /team/status`
* `GET /team/pause`
* `GET /team/resume`
* `GET /team/terminate`

### Available Scripts
In the project directory, you can:

#### `npm run start`
Runs the app and exposes port 8080,

#### `docker build -t <username>/long_running_app .`
Creates a docker image, based on Dockerfile in the source code.