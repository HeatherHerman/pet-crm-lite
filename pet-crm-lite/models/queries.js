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
  },

  async update(id, name) {
    await run('UPDATE businesses SET name = ? WHERE id = ?', [name, id]);
    return { id, name };
  },

  async delete(id) {
    await run('DELETE FROM businesses WHERE id = ?', [id]);
  }
};

// Customer operations
const Customer = {
  async create(businessId, data) {
    const { name, phone, email, address, notes } = data;
    const result = await run(
      'INSERT INTO customers (business_id, name, phone, email, address, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [businessId, name, phone, email || null, address || null, notes || null]
    );
    return { id: result.lastID, business_id: businessId, name, phone, email, address, notes };
  },

  async checkDuplicate(businessId, name, phone, excludeId = null) {
    const sql = excludeId 
      ? 'SELECT id, name, phone FROM customers WHERE business_id = ? AND name = ? AND phone = ? AND id != ?'
      : 'SELECT id, name, phone FROM customers WHERE business_id = ? AND name = ? AND phone = ?';
    const params = excludeId 
      ? [businessId, name, phone, excludeId]
      : [businessId, name, phone];
    return await get(sql, params);
  },

  async listByBusiness(businessId) {
    return await all('SELECT * FROM customers WHERE business_id = ? ORDER BY id', [businessId]);
  },

  async getById(id) {
    return await get('SELECT * FROM customers WHERE id = ?', [id]);
  },

  async update(id, data) {
    const { name, phone, email, address, notes } = data;
    await run(
      'UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, notes = ? WHERE id = ?',
      [name, phone, email || null, address || null, notes || null, id]
    );
    return { id, name, phone, email, address, notes };
  },

  async delete(id) {
    // Delete related pets, orders, reminders first
    await run('DELETE FROM reminders WHERE customer_id = ?', [id]);
    await run('DELETE FROM orders WHERE customer_id = ?', [id]);
    await run('DELETE FROM pets WHERE customer_id = ?', [id]);
    await run('DELETE FROM customers WHERE id = ?', [id]);
  }
};

// Pet operations
const Pet = {
  async create(customerId, data) {
    const { name, breed, birthdate, notes } = data;
    const result = await run(
      'INSERT INTO pets (customer_id, name, breed, birthdate, notes) VALUES (?, ?, ?, ?, ?)',
      [customerId, name, breed || null, birthdate || null, notes || null]
    );
    return { id: result.lastID, customer_id: customerId, name, breed, birthdate, notes };
  },

  async listByCustomer(customerId) {
    return await all('SELECT * FROM pets WHERE customer_id = ? ORDER BY id', [customerId]);
  },

  async getById(id) {
    return await get('SELECT * FROM pets WHERE id = ?', [id]);
  },

  async getAll() {
    return await all('SELECT p.*, c.name as customer_name FROM pets p JOIN customers c ON p.customer_id = c.id ORDER BY p.id');
  },

  async update(id, data) {
    const { name, breed, birthdate, notes } = data;
    await run(
      'UPDATE pets SET name = ?, breed = ?, birthdate = ?, notes = ? WHERE id = ?',
      [name, breed || null, birthdate || null, notes || null, id]
    );
    return { id, name, breed, birthdate, notes };
  },

  async delete(id) {
    await run('DELETE FROM pets WHERE id = ?', [id]);
  }
};

// Order operations
const Order = {
  async create(customerId, data) {
    const { pet_id, product, quantity, price, date, notes } = data;
    const result = await run(
      'INSERT INTO orders (customer_id, pet_id, product, quantity, price, date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [customerId, pet_id || null, product, quantity || 1, price || null, date, notes || null]
    );
    return { id: result.lastID, customer_id: customerId, pet_id, product, quantity, price, date, notes };
  },

  async listByCustomer(customerId) {
    return await all('SELECT * FROM orders WHERE customer_id = ? ORDER BY date DESC', [customerId]);
  },

  async getLastOrder(customerId) {
    return await get('SELECT * FROM orders WHERE customer_id = ? ORDER BY date DESC LIMIT 1', [customerId]);
  },

  async getAllByCustomer(customerId) {
    return await all('SELECT * FROM orders WHERE customer_id = ? ORDER BY date ASC', [customerId]);
  },

  async getAll() {
    return await all(`
      SELECT o.*, c.name as customer_name, c.phone, p.name as pet_name
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      LEFT JOIN pets p ON o.pet_id = p.id
      ORDER BY o.date DESC
    `);
  },

  async update(id, data) {
    const { pet_id, product, quantity, price, date, notes } = data;
    await run(
      'UPDATE orders SET pet_id = ?, product = ?, quantity = ?, price = ?, date = ?, notes = ? WHERE id = ?',
      [pet_id || null, product, quantity || 1, price || null, date, notes || null, id]
    );
    return { id, pet_id, product, quantity, price, date, notes };
  },

  async delete(id) {
    await run('DELETE FROM orders WHERE id = ?', [id]);
  },

  async bulkCreate(orders) {
    for (const order of orders) {
      await run(
        'INSERT INTO orders (customer_id, pet_id, product, date) VALUES (?, ?, ?, ?)',
        [order.customer_id, order.pet_id || null, order.product, order.date]
      );
    }
    return orders.length;
  }
};

// Reminder operations
const Reminder = {
  async create(customerId, data) {
    const { pet_id, due_date, notes } = data;
    const result = await run(
      'INSERT INTO reminders (customer_id, pet_id, due_date, status, notes) VALUES (?, ?, ?, ?, ?)',
      [customerId, pet_id || null, due_date, 'pending', notes || null]
    );
    return { id: result.lastID, customer_id: customerId, pet_id, due_date, status: 'pending', notes };
  },

  async list() {
    return await all(`
      SELECT r.*, c.name as customer_name, c.phone, c.pet_name, c.breed, b.name as business_name, p.name as pet_name
      FROM reminders r
      JOIN customers c ON r.customer_id = c.id
      JOIN businesses b ON c.business_id = b.id
      LEFT JOIN pets p ON r.pet_id = p.id
      WHERE r.status = 'pending'
      ORDER BY r.due_date
    `);
  },

  async getByCustomer(customerId) {
    return await all(`
      SELECT r.*, p.name as pet_name
      FROM reminders r
      LEFT JOIN pets p ON r.pet_id = p.id
      WHERE r.customer_id = ?
      ORDER BY r.due_date DESC
    `, [customerId]);
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
  },

  async update(id, data) {
    const { pet_id, due_date, status, notes } = data;
    await run(
      'UPDATE reminders SET pet_id = ?, due_date = ?, status = ?, notes = ? WHERE id = ?',
      [pet_id || null, due_date, status, notes || null, id]
    );
    return { id, pet_id, due_date, status, notes };
  },

  async delete(id) {
    await run('DELETE FROM reminders WHERE id = ?', [id]);
  }
};

module.exports = { db, run, get, all, Business, Customer, Pet, Order, Reminder };