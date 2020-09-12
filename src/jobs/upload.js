const fs = require('fs');

// Function to facilitate uploading process
const upload = (fileId, arg) => {
    var readable = fs.createReadStream(null, {fd: 3});
    var filestream = fs.createWriteStream('./tmp/' + fileId, {flags: arg});
    readable.pipe(filestream);

    var result;

    filestream.on('close', () => {
        console.log('upload finished');
        result = 'SUCCESS';
        process.send(result);
        process.exit(0);
    });

    filestream.on('error', (err) => {
        console.log("File stream error !!", err);
        result = 'Error';
        process.send(result);
        process.exit(0);
    })
}

// Checking messages from parent process and act accordingly
process.on('message', (message) => {

    // initiating upload process on 'START' message
    if(message == 'START') {
        upload(process.argv[2], process.argv[3]);
    }

    // send stop message to parent process to destroy streams and
    // facilitate exiting process before completition of upload process
    if(message == 'DESTROY') {
        console.log("Sending STOP message to stop piping");
        process.send('STOP');
    }
})