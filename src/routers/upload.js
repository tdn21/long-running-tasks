const express = require('express');
const fs = require('fs');
const { fork } = require('child_process');

const router = new express.Router();


var files = {};             // to store completely uploaded files information
var paused = {};            // to store paused uploads information
var tasks = {};             // ongoing upload tasks


// 
// route to start or resume upload
// ** 'x-file-id' 'x-start' 'user-id' 'x-file-size' are required headers
// 

router.post('/upload/start', (req, res) => {
    console.log('/upload/start');

    const fileId = req.headers['x-file-id'];
    const start = parseInt(req.headers['x-start'], 10);
    const userId = req.headers['user-id'];
    const fileSize = parseInt(req.headers['x-file-size'], 10);

    // Checking for required headers
    if(!fileId || !userId || !fileSize) {
        return res.status(400).end();
    }

    // Checking if file is already completely uploaded
    if(files[fileId]) {
        return res.status(200).send("File already uploaded");
    }

    // Checking if file is partially present
    // Using this method to include the event when upload is aborted 
    // from client side without hitting "upload/pause" route explicitly
    var stats = null;
    try {
        stats = fs.statSync('./tmp/' + fileId);
    } catch (err) {}

    // Setting arg value accordingly to pass it to child process
    var arg;
    if(stats && stats.isFile()) {
        if(start != stats.size) {
            res.status(400).end();
            return;
        }
        else { arg = 'a'; }
    }
    else { arg = 'w'; }

    try {
        // Initiating child process
        tasks[userId] = fork('./src/jobs/upload.js', [fileId, arg], {stdio : [process.stdin, process.stdout, "ignore", 'pipe', 'ipc']});

        // Listening to child message event
        tasks[userId].on('message', (message) => {
            console.log(`${message} received from child with child pid ${tasks[userId].pid}`);

            if(message === 'SUCCESS') 
            {
                delete tasks[userId];
                files[fileId] = {"id" : fileId, "size" : fileSize};
                return res.status(200).send(message);
            } 
            else if (message === 'STOP') 
            {
                req.unpipe(tasks[userId].stdio[3]);
                tasks[userId].stdio[3].pause();
                tasks[userId].stdio[3].destroy();

                process.kill(tasks[userId].pid, 'SIGTERM');
                console.log("Killed child process with pid : ", tasks[userId].pid);
                delete tasks[userId];
            }
            else 
            {
                return res.status(500).end();
            }
        })

        tasks[userId].on('exit', (code, signal) => {
            if(signal != null) {
                return res.status(500).send("Process either paused or terminated");
            }
        })

        tasks[userId].on('error', (err) => {
            console.log("Error : ", err);
            return res.status(500);
        })

        // Sending START message to child
        tasks[userId].send('START');

        // Piping req payload to child
        req.pipe(tasks[userId].stdio[3]);
    }
    catch (err) {
        console.log("Error", err);
    }
})


// 
// Route to get start point for paused file upload to resume
// 

router.get('/upload/status', (req,res) => {
    console.log("/upload/status");

    const fileId = req.headers['x-file-id'];
    const fileSize = parseInt(req.headers['x-file-size']);

    // Checking if file is already completely uploaded
    if(files[fileId]) {
        if(files[fileId].size != fileSize) {
            return res.status(400).send({"Error" : "File with same file id present with different size."});
        }
        return res.status(200).send("File already present");
    }

    // Checking if file is partially uploaded
    var stats = null;
    try {
        stats = fs.statSync('./tmp/' + fileId);
    } catch (err) {}

    if(stats && stats.isFile()) 
    {
        return res.status(200).send({"start" : stats.size});
    } 
    else 
    {
        return res.status(200).send({"start" : 0});
    }
})


// 
// Route to pause ongoing upload
// 

router.get('/upload/pause', (req, res) => {
    console.log("/upload/pause");

    const userId = req.headers['user-id'];
    const fileId = req.headers['x-file-id'];

    if(!tasks[userId] || !tasks[userId].pid) {
        return res.status(400).send({"Error" : "No ongoing process found"});
    }

    // Sending message to child to destroy streams and exit process
    tasks[userId].send('DESTROY');

    paused[userId] = {fileId};
    return res.status(200).send({"Success" : "Uploading process paused !"});
})


// 
// Route to terminate upload
// 

router.get('/upload/terminate', (req, res) => {
    console.log("/upload/terminate");

    var userId = req.headers['user-id'];
    var fileId = req.headers['x-file-id'];

    // Checking for ongoing process
    if(!tasks[userId] || !tasks[userId].pid) {
        return res.status(400).send({"Error" : "No ongoing process found"});
    }

    // Checking if process is previously paused
    if(paused[userId]) {
        fs.unlink("./tmp/" + fileId);
        return res.status(200).send({"Success" : "Uploading process terminated!"});
    }

    // Sending message to child to exit process
    tasks[userId].send('DESTROY');

    // Removing already uploaded file
    fs.unlink("./tmp/" + fileId, (err) => {
        if (err) console.log("Error", err);
    });

    return res.status(200).send({"Success" : "Uploading process terminated!"});
})


module.exports = router;