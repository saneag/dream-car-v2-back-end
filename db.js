import pg from 'pg';
import { randomBytes } from 'node:crypto';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const newId = () => randomBytes(12).toString('hex');
export const carFields = ['brand', 'model', 'year', 'fuel_type', 'engine_capacity',
    'engine_power', 'traction_type', 'gearbox_type', 'price', 'imageUrl', 'added_by', 'added_by_id'];
export const quote = (field) => '"' + field + '"';
