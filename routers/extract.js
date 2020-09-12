const express = require('express');
const { fork } = require('child_process');

const router = new express.Router();

var tasks = {};                     // to store information about tasks

// 
// route to start or resume extraction
// 

router.get('/extract/start', (req, res) => {
    console.log('/extract/start');

    const userId = req.headers['user-id'];
    const start = req.headers['x-start'];
    const end = req.headers['x-end'];

    // Checking for required header
    if(!userId || !start || !end) {
        return res.status(400).send({"Error" : "Required headers not present"});
    }

    // Checking if task is previously paused
    // Setting arg value accordingly to pass it to child process

    if(tasks[userId] && tasks[userId]["status"] === "paused") {
        if(start != tasks[userId].state) {
            return res.status(400).send("Wrong start for paused process.");
        }
    }

    if(!tasks[userId]) {
        tasks[userId] = {};
    }

    // to facilitate resume request without needing to call status route
    tasks[userId].req = {start, end};

    // Initiating child process
    tasks[userId]["task"] = fork('./jobs/extract.js', [start, end], {stdio : [process.stdin, process.stdout, process.stderr, 'pipe', 'ipc']});

    // Listening to child message event
    tasks[userId]["task"].on('message', (message) => {

        if(message["status"] === 'Success') 
        {
            console.log(`Success message received from child with pid ${tasks[userId].task.pid}`);

            const data = tasks[userId]["data"];
            delete tasks[userId];

            console.log("/extract/start response sent with required data");
            return res.status(200).send({"Data" : data});
        } 
        else if(message["status"] === 'Ongoing') 
        {
            tasks[userId]["status"] = "Ongoing";    
            tasks[userId]["state"] = message["state"];

            if(tasks[userId]["data"]) {
                tasks[userId]["data"].push(message.data);
            } else {
                tasks[userId]["data"] = [message.data];
            }
        } 
        else 
        {
            return res.status(500).end()
        }
    });

    // Terminating request in case user hit pause or terminate route and killed child process
    tasks[userId].task.on('exit', (code, signal) => {
        if(signal != null) {
            return res.status(500).send("Process either paused or terminated");
        }
    })

    // Sending START message to child
    tasks[userId]["task"].send('START');
})


// 
// Route to get status(ongoing/paused/no_task) of extraction task
// 

router.get('/extract/status', (req,res) => {
    console.log("/extract/status");

    const userId = req.headers['user-id'];

    // Checking for required headers
    if(!userId) {
        console.log("userId", userId);
        return res.status(400).send({"Error" : "Required headers not present"});
    }

    if(!tasks[userId]) {
        return res.status(200).send({"status" : "No ongoing extraction process!"});
    } 
    else {
        return res.status(200).send({"status" : tasks[userId]["status"], "start" : tasks[userId]["state"]});
    }
});


// 
// Route to pause
// 

router.get('/extract/pause', (req, res) => {
    console.log("/extract/pause");

    const userId = req.headers['user-id'];

    if(!tasks[userId] || !tasks[userId]["task"] || !tasks[userId]["task"].pid) {
        return res.status(400).send({"Error" : "No ongoing process found"});
    }

    process.kill(tasks[userId]["task"].pid, 'SIGTERM');
    delete tasks[userId]["task"];

    tasks[userId]["status"] = "Paused";
    res.status(200).send({"Success" : "Extraction process paused !"});
})

// 
// Route to resume
// 

router.get('/extract/resume', (req, res) => {
    console.log("/extract/resume");

    const userId = req.headers['user-id'];

    if(!tasks[userId] || tasks[userId].status != "Paused") {
        return res.status(400).send({"Error" : "No paused process found"});
    }

    const start = tasks[userId].req.start;
    const end = tasks[userId].req.end;
    
    // Initiating child process
    tasks[userId]["task"] = fork('./jobs/extract.js', [start, end], {stdio : [process.stdin, process.stdout, process.stderr, 'pipe', 'ipc']});

    // Listening to child message event
    tasks[userId]["task"].on('message', (message) => {

        if(message["status"] === 'Success') 
        {
            console.log(`Success message received from child with pid ${tasks[userId].task.pid}`);

            const data = tasks[userId]["data"];
            delete tasks[userId];

            console.log("/extract/start response sent with required data");
            return res.status(200).send({"Data" : data});
        } 
        else if(message["status"] === 'Ongoing') 
        {
            tasks[userId]["status"] = "Ongoing";    
            tasks[userId]["state"] = message["state"];

            if(tasks[userId]["data"]) {
                tasks[userId]["data"].push(message.data);
            } else {
                tasks[userId]["data"] = [message.data];
            }
        } 
        else 
        {
            return res.status(500).end()
        }
    });

    tasks[userId].task.on('exit', (code, signal) => {
        if(signal != null) {
            return res.status(500).send("Process either paused or terminated");
        }
    })

    // Sending START message to child
    tasks[userId]["task"].send('START');
})

// 
// Router to terminate upload
// 
router.get('/extract/terminate', (req, res) => {
    console.log("/extract/terminate");

    const userId = req.headers['user-id'];

    if(!tasks[userId]) {
        return res.status(400).send({"Error" : "No ongoing process found"});
    }

    if(tasks[userId].status === 'Paused') {
        delete tasks[userId];
        return res.status(200).send({"Success" : "Extraction process terminated!"})
    }
    
    process.kill(tasks[userId]["task"].pid, 'SIGTERM');
    delete tasks[userId];

    return res.status(200).send({"Success" : "Extraction process terminated!"});
})


module.exports = router;