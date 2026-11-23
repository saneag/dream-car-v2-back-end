import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const schema = 'test_' + Date.now();
await admin.query(`CREATE SCHEMA ${schema}`);
process.env.PGOPTIONS = '-c search_path=' + schema;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-test-secret';
let server, pool;
try {
    const migrated = spawnSync(process.execPath, ['scripts/migrate.js'], { env: process.env, encoding: 'utf8' });
    assert.equal(migrated.status, 0, migrated.stderr);
    ({ pool } = await import('../db.js'));
    const { default: app } = await import('../index.js');
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    async function request(path, method='GET', data, token) {
        const response = await fetch(origin+path, { method, headers: {
            'Content-Type':'application/json', ...(token ? { Authorization: 'Bearer '+token } : {})
        }, ...(data ? { body:JSON.stringify(data) } : {}) });
        return { status: response.status, data: await response.json() };
    }
    assert.equal((await request('/health')).status, 200);
    assert.equal((await request('/auth/me')).status, 403);
    const registration = await request('/auth/register','POST',{ name:'Test User',email:'migration@example.test',password:'test-password' });
    assert.equal(registration.status,200);
    assert.equal(registration.data.passwordHash,undefined);
    const token = registration.data.token;
    const id = registration.data._id;
    assert.equal((await request('/auth/register','POST',{ name:'Test User',email:'migration@example.test',password:'test-password' })).status,400);
    const login = await request('/auth/login','POST',{email:'migration@example.test',password:'test-password'});
    assert.equal(login.status,200);
    assert.equal(login.data._id,id);
    assert.equal((await request('/auth/me','GET',null,token)).data._id,id);
    const car = {brand:'Mazda',model:'RX-7',year:2002,fuel_type:'petrol',engine_capacity:1308,engine_power:280,traction_type:'rear',gearbox_type:'manual',price:40000,imageUrl:'uploads/test.jpg'};
    assert.equal((await request('/cars','POST',car)).status,403);
    const created = await request('/cars','POST',car,token);
    assert.equal(created.status,200);
    const carId = created.data._id;
    assert.equal(created.data.added_by_id,id);
    const listing = await request('/cars?limit=1&page=1&sortBy=price&sortOrder=-1&search=mazda');
    assert.equal(listing.status,200);
    assert.equal(listing.data.cars[0]._id,carId);
    assert.equal(listing.data.totalItems,1);
    assert.equal((await request('/cars?search=%27%3B%20DROP%20TABLE%20cars%3B--&sortBy=bad')).status,200);
    assert.equal((await request('/cars/'+carId,'PATCH',{price:45000},token)).status,200);
    assert.equal((await request('/cars/'+carId)).data.price,45000);
    assert.equal((await request('/cars/'+carId,'DELETE',null,token)).status,200);
    assert.equal((await request('/cars/'+carId)).status,404);
    console.log('PostgreSQL integration passed: health, auth, duplicate registration, car CRUD, filtering, sorting, SQL input handling');
} finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (pool) await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
}
