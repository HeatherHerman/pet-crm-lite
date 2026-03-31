const express = require('express');
const { Customer, Business } = require('../models/queries');

const router = express.Router();

// Create a new customer
router.post('/', async (req, res) => {
  try {
    const { business_id, name, phone, pet_name, breed } = req.body;
    
    if (!business_id || !name || !phone) {
      return res.status(400).json({ error: 'business_id, name, and phone are required' });
    }
    
    // Verify business exists
    const business = await Business.getById(business_id);
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }
    
    const customer = await Customer.create(business_id, name, phone, pet_name, breed);
    
    // If it's a form submission, redirect to dashboard
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
      return res.redirect('/dashboard');
    }
    
    res.status(201).json(customer);
  } catch (err) {
    console.error('Error creating customer:', err);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Get customers by business
router.get('/:business_id', async (req, res) => {
  try {
    const { business_id } = req.params;
    
    // Verify business exists
    const business = await Business.getById(business_id);
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }
    
    const customers = await Customer.listByBusiness(business_id);
    res.json(customers);
  } catch (err) {
    console.error('Error listing customers:', err);
    res.status(500).json({ error: 'Failed to list customers' });
  }
});

module.exports = router;