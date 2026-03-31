const db = require('./db');

// Promisify database operations
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Business operations
const Business = {
  async create(name) {
    const result = await run('INSERT INTO businesses (name) VALUES (?)', [name]);
    return { id: result.lastID, name };
  },

  async list() {
    return await all('SELECT * FROM businesses ORDER BY id');
  },

  async getById(id) {
    return await get('SELECT * FROM businesses WHERE id = ?', [id]);
  }
};

// Customer operations
const Customer = {
  async create(businessId, name, phone, petName, breed) {
    const result = await run(
      'INSERT INTO customers (business_id, name, phone, pet_name, breed) VALUES (?, ?, ?, ?, ?)',
      [businessId, name, phone, petName, breed]
    );
    return { id: result.lastID, business_id: businessId, name, phone, pet_name: petName, breed };
  },

  async listByBusiness(businessId) {
    return await all('SELECT * FROM customers WHERE business_id = ? ORDER BY id', [businessId]);
  },

  async getById(id) {
    return await get('SELECT * FROM customers WHERE id = ?', [id]);
  }
};

// Order operations
const Order = {
  async create(customerId, product, date) {
    const result = await run(
      'INSERT INTO orders (customer_id, product, date) VALUES (?, ?, ?)',
      [customerId, product, date]
    );
    return { id: result.lastID, customer_id: customerId, product, date };
  },

  async listByCustomer(customerId) {
    return await all('SELECT * FROM orders WHERE customer_id = ? ORDER BY date DESC', [customerId]);
  },

  async getLastOrder(customerId) {
    return await get('SELECT * FROM orders WHERE customer_id = ? ORDER BY date DESC LIMIT 1', [customerId]);
  },

  async getAllByCustomer(customerId) {
    return await all('SELECT * FROM orders WHERE customer_id = ? ORDER BY date ASC', [customerId]);
  }
};

// Reminder operations
const Reminder = {
  async create(customerId, dueDate) {
    const result = await run(
      'INSERT INTO reminders (customer_id, due_date, status) VALUES (?, ?, ?)',
      [customerId, dueDate, 'pending']
    );
    return { id: result.lastID, customer_id: customerId, due_date: dueDate, status: 'pending' };
  },

  async list() {
    return await all(`
      SELECT r.*, c.name as customer_name, c.phone, c.pet_name, c.breed, b.name as business_name
      FROM reminders r
      JOIN customers c ON r.customer_id = c.id
      JOIN businesses b ON c.business_id = b.id
      WHERE r.status = 'pending'
      ORDER BY r.due_date
    `);
  },

  async getByCustomer(customerId) {
    return await all('SELECT * FROM reminders WHERE customer_id = ? ORDER BY due_date DESC', [customerId]);
  },

  async markSent(id) {
    await run('UPDATE reminders SET status = ? WHERE id = ?', ['sent', id]);
  },

  async existsPendingForCycle(customerId, dueDate) {
    const result = await get(
      'SELECT id FROM reminders WHERE customer_id = ? AND status = ? AND due_date = ?',
      [customerId, 'pending', dueDate]
    );
    return !!result;
  }
};

module.exports = { db, run, get, all, Business, Customer, Order, Reminder };