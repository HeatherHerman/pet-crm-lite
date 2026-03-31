const express = require('express');
const { Order, Customer, Pet } = require('../models/queries');
const multer = require('multer');
const { parse } = require('csv-parse/sync');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ dest: '/tmp/' });

// GET all orders (with optional business_id filter)
router.get('/', async (req, res) => {
  try {
    const { business_id } = req.query;
    let orders;
    if (business_id) {
      orders = await Order.getAll();
      // Filter by business via join
      orders = orders.filter(o => o.business_id == business_id);
    } else {
      orders = await Order.getAll();
    }
    res.json(orders);
  } catch (err) {
    console.error('Error listing orders:', err);
    res.status(500).json({ error: 'Failed to list orders' });
  }
});

// POST create new order
router.post('/', async (req, res) => {
  try {
    const { customer_id, pet_id, product, quantity, price, date, notes } = req.body;
    
    if (!customer_id || !product) {
      return res.status(400).json({ error: 'customer_id and product are required' });
    }
    
    // Use today's date if not provided
    const orderDate = date || new Date().toISOString().split('T')[0];
    
    // Verify customer exists
    const customer = await Customer.getById(customer_id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const order = await Order.create(customer_id, { pet_id, product, quantity, price, date: orderDate, notes });
    
    // If it's a form submission, redirect to dashboard
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
      return res.redirect('/dashboard?msg=' + encodeURIComponent('Order added successfully'));
    }
    
    res.status(201).json(order);
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// PUT update order
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { pet_id, product, quantity, price, date, notes } = req.body;
    
    const orders = await Order.getAll();
    const existingOrder = orders.find(o => o.id == id);
    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const updated = await Order.update(id, { pet_id, product, quantity, price, date, notes });
    
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
      return res.redirect('/dashboard?msg=' + encodeURIComponent('Order updated successfully'));
    }
    
    res.json(updated);
  } catch (err) {
    console.error('Error updating order:', err);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// DELETE order
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const orders = await Order.getAll();
    const existingOrder = orders.find(o => o.id == id);
    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    await Order.delete(id);
    
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
      return res.redirect('/dashboard?msg=' + encodeURIComponent('Order deleted successfully'));
    }
    
    res.json({ message: 'Order deleted successfully' });
  } catch (err) {
    console.error('Error deleting order:', err);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// CSV Upload endpoint
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fs = require('fs');
    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    
    // Parse CSV
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    if (records.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty' });
    }
    
    // Validate columns
    const requiredCols = ['customer_name', 'phone', 'product', 'date'];
    const actualCols = Object.keys(records[0]).map(c => c.toLowerCase().trim());
    const missing = requiredCols.filter(c => !actualCols.includes(c));
    if (missing.length > 0) {
      return res.status(400).json({ 
        error: `Missing required columns: ${missing.join(', ')}`,
        received_columns: actualCols
      });
    }
    
    // Process each row
    let created = 0;
    let skipped = 0;
    const errors = [];
    
    for (const row of records) {
      const customerName = row.customer_name || row.Customer_Name;
      const phone = row.phone || row.Phone;
      const product = row.product || row.Product;
      const date = row.date || row.Date;
      
      if (!customerName || !phone || !product || !date) {
        errors.push(`Missing required data in row: ${JSON.stringify(row)}`);
        skipped++;
        continue;
      }
      
      // Find or create customer
      let customer;
      const existingCustomers = await Customer.listByBusiness(1); // Default to business 1
      const match = existingCustomers.find(c => 
        c.name.toLowerCase() === customerName.toLowerCase() && 
        c.phone === phone
      );
      
      if (match) {
        customer = match;
      } else {
        // Create new customer
        customer = await Customer.create(1, { name: customerName, phone });
      }
      
      // Create order
      await Order.create(customer.id, { product, date });
      created++;
    }
    
    // Clean up temp file
    fs.unlinkSync(req.file.path);
    
    const message = `CSV Import Complete: ${created} orders created, ${skipped} skipped`;
    console.log(message);
    if (errors.length > 0) {
      console.log('Errors:', errors);
    }
    
    res.json({
      message,
      created,
      skipped,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('Error processing CSV:', err);
    res.status(500).json({ error: 'Failed to process CSV file' });
  }
});

module.exports = router;
