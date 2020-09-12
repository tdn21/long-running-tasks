const fs = require('fs');
const readline = require('readline');

// function to increase execution time to simulate long running process
const long_running_function = (start) => {
    if(!start)
        start = 0;
    let counter = start;
    while(counter < 100000000) {
        counter++;
    }
}

// demonstration team creation process
const createTeam = (arg) => {
    var count = 1;

    const readInterface = readline.createInterface({
        input: fs.createReadStream('./data/demo_names.txt'),
        console: false
    });

    readInterface.on('line', function(line) {
        if(count > arg) {
            var message = {
                "status" : "Ongoing",
                "state" : count,
                "data" : line
            }
            long_running_function(0);
            process.send(message);
        }
        count = count + 1;
    });

    readInterface.on('close', () => {
        var message = {"status" : "Success"};
        process.send(message);
        process.exit(0);
    });
}

// Initiating team creation process on 'START'
process.on('message', (message) => {
    if(message == 'START') {
        createTeam(process.argv[2]);
    }
});