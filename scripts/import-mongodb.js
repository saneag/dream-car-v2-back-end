import { MongoClient } from 'mongodb';
import { writeFile, readFile } from 'node:fs/promises';
import { pool, carFields, quote } from '../db.js';

const mode = process.argv[2];
const backup = process.env.MONGO_BACKUP_PATH;
if (!backup) throw new Error('Set a private MONGO_BACKUP_PATH');
if (mode === 'export') {
    const source = new MongoClient(process.env.SOURCE_MONGO_URI, { serverSelectionTimeoutMS: 20000 });
    try {
        await source.connect();
        const db = source.db();
        const users = await db.collection('users').find().toArray();
        const cars = await db.collection('cars').find().toArray();
        const collections = (await db.listCollections().toArray()).map(c => c.name);
        if (collections.some(name => !['users', 'cars'].includes(name))) {
            throw new Error('Unexpected source collections; inspect before migration');
        }
        await writeFile(backup, JSON.stringify({ users, cars }, null, 2), { mode: 0o600, flag: 'wx' });
        const images = cars.map(c => c.imageUrl).filter(Boolean);
        console.log(JSON.stringify({ users: users.length, cars: cars.length,
            relativeImages: images.filter(s => !/^https?:/.test(s)).length,
            externalImageHosts: [...new Set(images.filter(s => /^https?:/.test(s)).map(s => new URL(s).hostname))] }));
    } finally { await source.close(); await pool.end(); }
} else if (mode === 'import') {
    const data = JSON.parse(await readFile(backup, 'utf8'));
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('LOCK TABLE users, cars IN ACCESS EXCLUSIVE MODE');
        const existing = await client.query('SELECT (SELECT count(*) FROM users) + (SELECT count(*) FROM cars) AS count');
        if (Number(existing.rows[0].count)) throw new Error('Target must be empty; refusing to overwrite data');
        for (const user of data.users) {
            await client.query('INSERT INTO users (_id,name,email,"passwordHash","avatarUrl",role,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
                [String(user._id),user.name,user.email,user.passwordHash,user.avatarUrl || null,user.role || 'user',user.createdAt || new Date(),user.updatedAt || user.createdAt || new Date()]);
        }
        for (const car of data.cars) {
            await client.query(`INSERT INTO cars (_id,${carFields.map(quote).join(',')}) VALUES (${['_id',...carFields].map((_,i) => '$'+(i+1)).join(',')})`,
                [String(car._id),...carFields.map(f => car[f] == null ? null : f === 'added_by_id' ? String(car[f]) : car[f])]);
        }
        const { rows: [counts] } = await client.query('SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM cars) AS cars');
        if (Number(counts.users) !== data.users.length || Number(counts.cars) !== data.cars.length) throw new Error('Record counts differ');
        // Every persisted field must match, including password hashes and image paths.
        const users = await client.query('SELECT * FROM users');
        const cars = await client.query('SELECT * FROM cars');
        for (const source of data.users) {
            const target = users.rows.find(row => row._id === String(source._id));
            for (const field of ['name','email','passwordHash']) {
                if (target[field] !== source[field]) throw new Error('User verification failed');
            }
        }
        for (const source of data.cars) {
            const target = cars.rows.find(row => row._id === String(source._id));
            for (const field of carFields) {
                if (String(target[field]) !== String(source[field] ?? null)) throw new Error('Car verification failed: ' + field);
            }
        }
        await client.query('COMMIT');
        console.log('Imported and verified users=' + counts.users + ', cars=' + counts.cars);
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    finally { client.release(); await pool.end(); }
} else { await pool.end(); throw new Error('Use export or import'); }
