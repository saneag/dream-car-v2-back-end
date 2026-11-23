import 'dotenv/config';
import { pool } from '../db.js';
try {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            _id text PRIMARY KEY,
            name text NOT NULL,
            email text NOT NULL UNIQUE,
            "passwordHash" text NOT NULL,
            "avatarUrl" text,
            role text,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS cars (
            _id text PRIMARY KEY,
            brand text NOT NULL,
            model text NOT NULL,
            year integer NOT NULL,
            fuel_type text NOT NULL,
            engine_capacity integer NOT NULL,
            engine_power integer NOT NULL,
            traction_type text NOT NULL,
            gearbox_type text NOT NULL,
            price double precision NOT NULL,
            "imageUrl" text NOT NULL,
            added_by text,
            added_by_id text
        );
        ALTER TABLE cars ALTER COLUMN added_by DROP NOT NULL;
        ALTER TABLE cars ALTER COLUMN added_by_id DROP NOT NULL;
    `);
    console.log('PostgreSQL schema ready');
} finally {
    await pool.end();
}
