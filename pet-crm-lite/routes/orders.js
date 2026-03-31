const express = require('express');
const { Order, Customer } = require('../models/queries');

const router = express.Router();

// Create a new order
router.post('/', async (req, res) => {
  try {
    const { customer_id, product, date } = req.body;
    
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
    
    const order = await Order.create(customer_id, product, orderDate);
    
    // If it's a form submission, redirect to dashboard
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
      return res.redirect('/dashboard');
    }
    
    res.status(201).json(order);
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

module.exports = router;