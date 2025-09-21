const mongoose = require('mongoose');

let listenersSet = false;

const connectDB = async () => {
    if (!process.env.MONGO_URI) {
        console.error('MONGO_URI missing');
        process.exit(1);
    }
    try {
        if (process.env.MONGOOSE_DEBUG === 'true') {
            mongoose.set('debug', (coll, method, query, doc) => {
                console.log(`[Mongoose] ${coll}.${method}`, JSON.stringify(query), doc ? JSON.stringify(doc).slice(0,150) : '');
            });
        }
        if (!listenersSet) {
            listenersSet = true;
            mongoose.connection.on('connected', () => console.log('Mongo connected')); 
            mongoose.connection.on('error', err => console.error('Mongo error:', err.message));
            mongoose.connection.on('disconnected', () => console.warn('Mongo disconnected'));
        }
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
            maxPoolSize: 10,
            autoIndex: true,
        });
        return mongoose.connection;
    } catch (err) {
        console.error('DB connect failed:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
