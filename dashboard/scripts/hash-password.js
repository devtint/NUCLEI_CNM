const bcrypt = require('bcrypt');

const password = process.argv[2];

if (!password) {
    console.error('Usage: node hash-password.js <your_password>');
    process.exit(1);
}

const saltRounds = 12;

bcrypt.hash(password, saltRounds, function (err, hash) {
    if (err) {
        console.error('Error hashing password:', err);
        process.exit(1);
    }
    console.log('\n✅ Password Hashed Successfully!');
    console.log('------------------------------------------------');
    console.log(`Password: ${password}`);
    console.log(`Hash:     ${hash}`);
    console.log('------------------------------------------------');
    console.log('\nCopy the Hash value and set it as ADMIN_PASSWORD_HASH in your .env.local file.\n');
});
