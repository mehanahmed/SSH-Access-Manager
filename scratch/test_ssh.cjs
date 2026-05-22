const { exec } = require('child_process');
const cmd = 'start ssh user@localhost';
exec(cmd, (error) => {
    if (error) {
        console.error(`Error: ${error}`);
    } else {
        console.log('Success');
    }
});
