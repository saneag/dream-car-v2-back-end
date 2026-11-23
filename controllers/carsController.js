import { pool, newId, carFields, quote } from '../db.js';

export const getAll = async (req, res) => {
    try {
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 12));
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const sort = ['brand', 'year', 'engine_power', 'price'].includes(req.query.sortBy) ? req.query.sortBy : 'brand';
        const direction = String(req.query.sortOrder) === '-1' ? 'DESC' : 'ASC';
        const search = String(req.query.search || '');
        const { rows: [{ count }] } = await pool.query('SELECT count(*) FROM cars');
        const { rows: cars } = await pool.query(
            `SELECT * FROM cars WHERE strpos(lower(brand),lower($1))>0 OR strpos(lower(model),lower($1))>0 ORDER BY ${quote(sort)} ${direction}, _id ${direction} LIMIT $2 OFFSET $3`,
            [search, limit, limit * (page - 1)]);
        res.json({ cars, totalItems: Number(count) });
    } catch {
        res.status(500).json({ message: 'Could not get cars' });
    }
};

export const getOne = async (req, res) => {
    try {
        const { rows: [car] } = await pool.query('SELECT * FROM cars WHERE _id=$1', [req.params.id]);
        if (!car) return res.status(404).json({ message: 'Car not found' });
        res.json(car);
    } catch {
        res.status(500).json({ message: 'Could not get car' });
    }
};

export const setCar = async (req, res) => {
    try {
        const { rows: [user] } = await pool.query('SELECT name FROM users WHERE _id=$1', [req.userId]);
        if (!user) return res.status(403).json({ message: 'Access denied' });
        const data = { ...req.body, added_by: user.name, added_by_id: req.userId };
        const { rows: [car] } = await pool.query(
            `INSERT INTO cars (_id, ${carFields.map(quote).join(',')}) VALUES (${carFields.map((_, i) => '$' + (i+2)).reduce((s, p) => s + ',' + p, '$1')}) RETURNING *`,
            [newId(), ...carFields.map(field => data[field])]);
        res.json(car);
    } catch {
        res.status(500).json({ message: 'Could not create car' });
    }
};

export const updateCar = async (req, res) => {
    try {
        const fields = carFields.filter(field => !['added_by', 'added_by_id'].includes(field) && Object.hasOwn(req.body, field));
        if (!fields.length) return res.status(400).json({ message: 'No car fields supplied' });
        const result = await pool.query(
            `UPDATE cars SET ${fields.map((field, i) => quote(field) + '=$' + (i+2)).join(',')} WHERE _id=$1`,
            [req.params.id, ...fields.map(field => req.body[field])]);
        if (!result.rowCount) return res.status(404).json({ message: 'Car not found' });
        res.json({ success: true });
    } catch {
        res.status(500).json({ message: 'Could not update car' });
    }
};

export const deleteCar = async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM cars WHERE _id=$1', [req.params.id]);
        if (!result.rowCount) return res.status(404).json({ message: 'Car not found' });
        res.json({ success: true });
    } catch {
        res.status(500).json({ message: 'Could not delete car' });
    }
};
