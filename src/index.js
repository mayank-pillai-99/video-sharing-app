import dotenv from 'dotenv';
import connectDB from './db/index.js';
import {app } from './app.js';

dotenv.config({
    path: './env',
});


connectDB()
.then(() => {
    const PORT = process.env.PORT || 3000;
    app.on('error', (err) => {
        console.error('Server error:', err);
    });
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
})
.catch((error) => {
    console.error('Database connection failed:', error);
    process.exit(1);
}

);