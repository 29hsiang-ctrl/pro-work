import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import projects       from './routes/projects.js';
import groups         from './routes/groups.js';
import drawings       from './routes/drawings.js';
import factory        from './routes/factory.js';
import settings       from './routes/settings.js';
import init           from './routes/init.js';
import auth           from './routes/auth.js';
import users          from './routes/users.js';
import calendar       from './routes/calendar.js';
import storage        from './routes/storage.js';
import storageFolders from './routes/storageFolders.js';
import calendarPhotos from './routes/calendarPhotos.js';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_, res) => res.json({ ok: true }));

app.use('/api/projects',       projects);
app.use('/api/groups',         groups);
app.use('/api/drawings',       drawings);
app.use('/api/factory',        factory);
app.use('/api/settings',       settings);
app.use('/api/init',           init);
app.use('/api/auth',           auth);
app.use('/api/users',          users);
app.use('/api/calendar',       calendar);
app.use('/api/storage',        storage);
app.use('/api/storageFolders', storageFolders);
app.use('/api/calendarPhotos', calendarPhotos);

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API :${PORT}`));
