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

// demonstration extraction process
const extractData = (start, end) => {
    var count = 1;

    const readInterface = readline.createInterface({
        input: fs.createReadStream('./data/demo_data.csv'),
        console: false
    });

    readInterface.on('line', function(line) {
        if(count > start && count <= end) {
            var message = {
                "status" : "Ongoing",
                "state" : count,
                "data" : {[count] : line}
            }
            long_running_function(0);
            process.send(message);
        }
        count++;
    });

    readInterface.on('close', () => {
        var message = {"status" : "Success"};
        process.send(message);
        process.exit(0);
    });
}

// To initiate extraction process on 'START'
process.on('message', (message) => {
    if(message == 'START') {
        extractData(process.argv[2], process.argv[3]);
    }
});