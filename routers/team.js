const express = require('express');
const { fork } = require('child_process');

const router = new express.Router();

var tasks = {};                 // to store information about tasks

// 
// route to start or resume team creation
// ** 'user-id' is required header
// 

router.get('/team/start', (req, res) => {
    console.log('/team/start');

    const userId = req.headers['user-id'];

    // Checking for required header
    if(!userId) {
        return res.status(400).send({"Error" : "Required headers not present"});
    }

    // Checking if task is previously paused
    // Setting arg value accordingly to pass it to child process
    var arg;
    if(tasks[userId] && tasks[userId]["status"] === "paused") {
        arg = tasks[userId]["state"];
    }
    else {
        arg = 0;
    }

    if(!tasks[userId]) {
        tasks[userId] = {};
    }

    // Initiating child process
    tasks[userId]["task"] = fork('./jobs/team.js', [arg], {stdio : [process.stdin, process.stdout, process.stderr, 'pipe', 'ipc']});

    // Listening to child message events
    tasks[userId]["task"].on('message', (message) => {

        if(message["status"] === 'Success') 
        {
            console.log(`Success message received from child with pid ${tasks[userId].task.pid}`);

            const data = tasks[userId]["data"];
            delete tasks[userId];

            console.log("/team/start response sent with required data");
            return res.status(200).send({"Team Leaders" : data});
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
// Route to get status(ongoing/paused/no_task) of team creation task
// 

router.get('/team/status', (req,res) => {
    console.log("/team/status");

    const userId = req.headers['user-id'];

    // Checking for required headers
    if(!userId) {
        console.log("userId", userId);
        return res.status(400).send({"Error" : "Required headers not present"});
    }

    if(!tasks[userId]) {
        return res.status(200).send({"status" : "No ongoing team creation process!"});
    } 
    else {
        return res.status(200).send({"status" : tasks[userId]["status"], "state" : tasks[userId]["state"]});
    }
});


// 
// Route to pause
// 

router.get('/team/pause', (req, res) => {
    console.log("/team/pause");

    const userId = req.headers['user-id'];

    if(!tasks[userId] || !tasks[userId]["task"] || !tasks[userId]["task"].pid) {
        return res.status(400).send({"Error" : "No ongoing process found"});
    }

    // killing child process
    process.kill(tasks[userId]["task"].pid, 'SIGTERM');
    delete tasks[userId]["task"];

    // updating task status
    tasks[userId]["status"] = "Paused";

    res.status(200).send({"Success" : "Team creation process paused !"});
})


// 
// Route to resume upload
// 

router.get('/team/resume', (req, res) => {
    console.log("/team/resume");

    const userId = req.headers['user-id'];

    if(!tasks[userId] || tasks[userId].status != "Paused") {
        return res.status(400).send({"Error" : "No paused process found"});
    }

    tasks[userId]["task"] = fork('./jobs/team.js', [tasks[userId].state], {stdio : [process.stdin, process.stdout, process.stderr, 'pipe', 'ipc']});

    // Listening to child message event
    tasks[userId]["task"].on('message', (message) => {

        if(message["status"] === 'Success') 
        {
            console.log(`Success message received from child with pid ${tasks[userId].task.pid}`);

            const data = tasks[userId]["data"];
            delete tasks[userId];

            return res.status(200).send({"Team Leaders" : data});
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
// Route to terminate upload
// 

router.get('/team/terminate', (req, res) => {
    console.log("/team/terminate");

    const userId = req.headers['user-id'];

    if(!tasks[userId]) {
        return res.status(400).send({"Error" : "No ongoing process found"});
    }

    if(tasks[userId].status === 'Paused') {
        delete tasks[userId];
        return res.status(200).send({"Success" : "Team creation process terminated!"})
    }

    // killing child process
    process.kill(tasks[userId]["task"].pid, 'SIGTERM');
    delete tasks[userId];

    return res.status(200).send({"Success" : "Team creation process terminated!"});
})


module.exports = router;