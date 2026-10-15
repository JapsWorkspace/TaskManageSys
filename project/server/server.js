const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const apiRoutes = require('./routes/apiRoutes');
const { notFound, errorHandler } = require('./middleware/errors');
const { setIO } = require('./services/events');
const { verifyAuthToken } = require('./utils/token');
const {
    createCorsOptions,
    getAllowedOrigins,
    getMongoUri,
    shouldUseLocalDatabaseFallback,
} = require('./config/runtime');
const path = require('path');

const allowedOrigins = getAllowedOrigins(process.env);
const corsOptions = createCorsOptions(allowedOrigins);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions });
setIO(io);

const PORT = process.env.PORT || 8000;
const MONGO_URI = getMongoUri(process.env);

// ====================
// Middleware
// ====================

app.use(cors(corsOptions));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ====================
// Routes
// ====================

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// ====================
// Test Route
// ====================

app.get('/', (req, res) => {
    res.json({
        message: 'Server is running'
    });
});

io.use((socket, next) => {
    try { socket.user = verifyAuthToken(socket.handshake.auth?.token); next(); }
    catch (_) { next(new Error('Authentication required.')); }
});
io.on('connection', (socket) => socket.join(`user:${socket.user.id}`));

app.use(notFound);
app.use(errorHandler);

// ====================
// MongoDB Connection
// ====================

const connectDatabase = async () => {
    try {
        await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
        console.log('MongoDB Atlas connected successfully');
    } catch (error) {
        if (!shouldUseLocalDatabaseFallback(process.env)) throw error;
        console.warn('MongoDB Atlas unavailable; using local development database.');
        await mongoose.disconnect().catch(() => {});
        await mongoose.connect(getMongoUri({ ...process.env, MONGO_URI: '', NODE_ENV: 'development' }));
        console.log('Local MongoDB connected successfully');
    }
    console.log('Database:', mongoose.connection.name);
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

connectDatabase().catch((error) => {
    console.error('MongoDB connection failed:');
    console.error(error.message);
});

